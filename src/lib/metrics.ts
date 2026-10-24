import type { AppData, EscapeType, FocusSession } from './types';
import { addDays, dayKey, minutesBetween } from './utils';

/** Meia-noite local do dia `n` dias antes de `today` (n = 0 → hoje). */
function startOfDayAgo(today: Date, n: number): number {
  const d = addDays(today, -n);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Minutos efetivos de uma sessão (planejado se concluída; decorrido se abandonada). */
export function sessionMinutes(s: FocusSession): number {
  if (s.completed) return s.plannedMin;
  if (s.end) return Math.min(s.plannedMin, minutesBetween(s.start, s.end));
  return 0;
}

export function focusMinutesOn(data: Pick<AppData, 'focusSessions'>, day: string): number {
  return data.focusSessions.filter((s) => dayKey(s.start) === day).reduce((a, s) => a + sessionMinutes(s), 0);
}

export function blocksOn(data: Pick<AppData, 'focusSessions'>, day: string) {
  const list = data.focusSessions.filter((s) => dayKey(s.start) === day);
  return { total: list.length, completed: list.filter((s) => s.completed).length };
}

/** Série diária dos últimos `n` dias (antigo → recente) de minutos de foco. */
export function focusSeries(data: Pick<AppData, 'focusSessions'>, n = 30, today = new Date()) {
  return Array.from({ length: n }, (_, i) => {
    const d = dayKey(addDays(today, i - n + 1));
    return { date: d, minutes: focusMinutesOn(data, d) };
  });
}

/** Média móvel de 7 dias dos minutos de foco. */
export function focusMovingAvg7(data: Pick<AppData, 'focusSessions'>, today = new Date()): number {
  const s = focusSeries(data, 7, today);
  return Math.round(s.reduce((a, x) => a + x.minutes, 0) / 7);
}

/**
 * % de blocos planejados que foram iniciados (blocos planejados = horários em dayPlans).
 * Horários de hoje que ainda não chegaram não entram na conta.
 */
export function plannedStartedRate(data: Pick<AppData, 'dayPlans' | 'focusSessions'>, n = 7, today = new Date()): number | null {
  let planned = 0;
  let started = 0;
  const todayKey = dayKey(today);
  const nowMin = today.getHours() * 60 + today.getMinutes();
  for (let i = 0; i < n; i++) {
    const d = dayKey(addDays(today, -i));
    const plan = data.dayPlans.find((p) => p.date === d);
    const blocks = (plan?.plannedBlocks ?? []).filter((hhmm) => {
      if (d !== todayKey) return true;
      const [h, m] = hhmm.split(':').map(Number);
      return h * 60 + m <= nowMin;
    });
    const p = blocks.length;
    planned += p;
    started += Math.min(p, data.focusSessions.filter((s) => dayKey(s.start) === d).length);
  }
  return planned ? Math.round((started / planned) * 100) : null;
}

export function urgeStats(data: Pick<AppData, 'urges'>, n = 30, today = new Date()) {
  const from = startOfDayAgo(today, n - 1);
  const list = data.urges.filter((u) => new Date(u.at).getTime() >= from);
  const resisted = list.filter((u) => u.outcome === 'resisted').length;
  const drops = list.filter((u) => u.intensityAfter != null).map((u) => u.intensityBefore - (u.intensityAfter ?? 0));
  return {
    total: list.length,
    resisted,
    resistedPct: list.length ? Math.round((resisted / list.length) * 100) : null,
    avgDrop: drops.length ? Math.round((drops.reduce((a, b) => a + b, 0) / drops.length) * 10) / 10 : null,
  };
}

/**
 * "% de dias dentro do plano" nos últimos 30 dias: um dia conta se houve
 * ao menos um bloco concluído e nenhum lapso, ou um lapso analisado (com novo se-então).
 * Nunca é um contador que zera.
 */
export function daysWithinPlan(data: Pick<AppData, 'focusSessions' | 'lapses'>, n = 30, today = new Date()) {
  const days = Array.from({ length: n }, (_, i) => dayKey(addDays(today, i - n + 1)));
  const marks = days.map((d) => {
    const blocks = data.focusSessions.filter((s) => dayKey(s.start) === d && s.completed).length;
    const lapses = data.lapses.filter((l) => dayKey(l.at) === d);
    const unanalyzed = lapses.filter((l) => !l.chain?.newIfThen).length;
    const within = blocks > 0 && unanalyzed === 0;
    return { date: d, within, blocks, lapses: lapses.length };
  });
  const active = marks.filter((m) => m.blocks > 0 || m.lapses > 0);
  const pct = active.length ? Math.round((marks.filter((m) => m.within).length / n) * 100) : null;
  return { pct, marks };
}

/**
 * Momentos de lapso (registro de lapso + SOS que terminou em lapso), sem contar duas vezes
 * o SOS que levou a um registro de lapso do mesmo tipo na hora seguinte.
 */
function lapseMoments(data: Pick<AppData, 'lapses' | 'urges'>, from: number): { type: EscapeType; at: Date }[] {
  const lapses = data.lapses.map((l) => ({ type: l.type, at: new Date(l.at) }));
  const urges = data.urges
    .filter((u) => u.outcome === 'lapsed')
    .map((u) => ({ type: u.type, at: new Date(u.at) }))
    .filter((u) => !lapses.some((l) => l.type === u.type && l.at.getTime() >= u.at.getTime() && l.at.getTime() - u.at.getTime() <= 3_600_000));
  return [...lapses, ...urges].filter((x) => x.at.getTime() >= from);
}

/** Mapa de calor de lapsos: tipo × faixa de 3 horas. */
export const HOUR_BANDS = ['0–3', '3–6', '6–9', '9–12', '12–15', '15–18', '18–21', '21–24'] as const;
export function lapseHeatmap(data: Pick<AppData, 'lapses' | 'urges'>, n = 60, today = new Date()) {
  const grid = new Map<EscapeType, number[]>();
  for (const { type, at } of lapseMoments(data, startOfDayAgo(today, n - 1))) {
    const row = grid.get(type) ?? Array(8).fill(0);
    row[Math.floor(at.getHours() / 3)]++;
    grid.set(type, row);
  }
  return grid;
}

/** Horas (0–23) com mais lapsos nas últimas 2 semanas: a "janela de risco" do JITAI. */
export function riskHours(data: Pick<AppData, 'lapses' | 'urges'>, today = new Date(), top = 2): number[] {
  const counts = Array(24).fill(0) as number[];
  lapseMoments(data, startOfDayAgo(today, 13)).forEach(({ at }) => counts[at.getHours()]++);
  return counts
    .map((c, h) => ({ c, h }))
    .filter((x) => x.c > 0)
    .sort((a, b) => b.c - a.c || a.h - b.h)
    .slice(0, top)
    .map((x) => x.h);
}

export function sleepHours(bedtime?: string, wake?: string): number | null {
  if (!bedtime || !wake) return null;
  const [bh, bm] = bedtime.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  if ([bh, bm, wh, wm].some((x) => Number.isNaN(x))) return null;
  let mins = wh * 60 + wm - (bh * 60 + bm);
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 10) / 10;
}
