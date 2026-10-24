// JITAI local (Nahum-Shani et al., 2018). `decide` é puro; `startJitai` é o runtime do navegador.
import type { AppData, FocusSession, NotificationLog, Task } from './types';
import { addDays, dayKey, uid } from './utils';
import { riskHours } from './metrics';
import { ESCAPE_LABELS } from './defaults';

export type JitaiRule = 'pre_block' | 'missed_block' | 'risk_window' | 'bedtime';

export interface Decision {
  rule: JitaiRule;
  /** Chave única do ponto de decisão (vai para `NotificationLog.rule`); evita repetir. */
  key: string;
  title: string;
  body: string;
  route: string;
}

export const MAX_PER_DAY = 3;
export const QUIET_FROM = 23;
export const QUIET_UNTIL = 8;
/** Abaixo disso (em 7 dias) a frequência cai pela metade. */
export const LOW_OPEN_RATE = 0.2;
/** Mínimo de envios em 7 dias para a taxa de abertura valer como sinal. */
export const MIN_SAMPLE = 5;

const PRIORITY: JitaiRule[] = ['pre_block', 'missed_block', 'risk_window', 'bedtime'];

export function isQuiet(now: Date): boolean {
  const h = now.getHours();
  return h >= QUIET_FROM || h < QUIET_UNTIL;
}

function minutesOf(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function at(now: Date, minutes: number): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutes);
  return d;
}

function ruleOf(log: NotificationLog): string {
  return log.rule.split(':')[0];
}

/** Taxa de abertura dos últimos 7 dias, ou null se ainda não há envios suficientes. */
export function openRate7(logs: NotificationLog[], now: Date): number | null {
  const from = addDays(now, -7).getTime();
  const recent = logs.filter((l) => l.delivered && new Date(l.at).getTime() >= from && new Date(l.at).getTime() <= now.getTime());
  if (recent.length < MIN_SAMPLE) return null;
  return recent.filter((l) => l.opened).length / recent.length;
}

/** Limite do dia: 3, ou metade (arredondada para baixo, mínimo 1) com abertura baixa. */
export function dailyLimit(logs: NotificationLog[], now: Date): number {
  const rate = openRate7(logs, now);
  return rate != null && rate < LOW_OPEN_RATE ? Math.max(1, Math.floor(MAX_PER_DAY / 2)) : MAX_PER_DAY;
}

const SENSITIVE = new RegExp(
  [
    ...Object.values(ESCAPE_LABELS).flatMap((l) => l.label.toLowerCase().split(/\s*\/\s*/)),
    'porn',
    'masturb',
    'sexo',
    'sexual',
    'nude',
    'xxx',
    'onlyfans',
    'jogo',
    'game',
    'instagram',
    'tiktok',
    'youtube',
    'twitter',
    'reddit',
  ]
    .filter((w) => w.length > 2 && w !== 'outro')
    .map((w) => w.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
  'i',
);

/** Texto de notificação aparece na tela bloqueada: nada que cite o tipo de fuga. */
export function isSensitive(text: string): boolean {
  return SENSITIVE.test(text.normalize('NFD').replace(/[̀-ͯ]/g, ''));
}

function safe(text: string | undefined, fallback: string): string {
  const t = text?.trim();
  if (!t || isSensitive(t)) return fallback;
  return t.length > 110 ? `${t.slice(0, 107).trimEnd()}...` : t;
}

function inProgress(sessions: FocusSession[], now: Date): boolean {
  return sessions.some((s) => {
    if (s.end) return false;
    const start = new Date(s.start).getTime();
    return start <= now.getTime() && now.getTime() - start < (s.plannedMin + s.breakMin) * 60_000;
  });
}

function startedBetween(sessions: FocusSession[], from: Date, to: Date): boolean {
  return sessions.some((s) => {
    const t = new Date(s.start).getTime();
    return t >= from.getTime() && t <= to.getTime();
  });
}

function mainTask(data: AppData, day: string): Task | undefined {
  const ids = data.dayPlans.find((p) => p.date === day)?.priorities ?? [];
  const tasks = ids.map((id) => data.tasks.find((t) => t.id === id)).filter((t): t is Task => Boolean(t) && t!.status !== 'done' && t!.status !== 'dropped');
  return tasks.find((t) => t.area === 'academic') ?? tasks[0];
}

/** Todos os pontos de decisão ativos agora, antes de orçamento e silêncio. */
export function candidates(data: AppData, now: Date): Decision[] {
  const day = dayKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const plan = data.dayPlans.find((p) => p.date === day);
  const task = mainTask(data, day);
  const taskQ = task ? `&task=${task.id}` : '';
  const out: Decision[] = [];
  const busy = inProgress(data.focusSessions, now);

  for (const hhmm of plan?.plannedBlocks ?? []) {
    const m = minutesOf(hhmm);
    if (m == null || busy) continue;
    const delta = m - nowMin;
    const label = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    if (delta > 0 && delta <= 5) {
      out.push({
        rule: 'pre_block',
        key: `pre_block:${day}:${label}`,
        title: `Bloco das ${label} em ${delta} min`,
        body: `Primeiro passo: ${safe(task?.firstStep, 'abrir o material e ler a primeira linha')}.`,
        route: `/foco?min=${data.profile?.focusDefaults.workMin ?? 25}${taskQ}`,
      });
    }
    // 10 min depois do horário, sem bloco iniciado desde 15 min antes dele.
    if (delta <= -10 && delta > -30 && !startedBetween(data.focusSessions, at(now, m - 15), now)) {
      out.push({
        rule: 'missed_block',
        key: `missed_block:${day}:${label}`,
        title: 'Quer um bloco de 12 min?',
        body: `O bloco das ${label} ainda não começou. Doze minutos já contam.`,
        route: `/foco?min=12${taskQ}`,
      });
    }
  }

  const hours = riskHours(data, now);
  if (!busy && hours.includes(now.getHours())) {
    const last = [...data.checkins].sort((a, b) => b.at.localeCompare(a.at))[0];
    const fresh = last && now.getTime() - new Date(last.at).getTime() < 3 * 3_600_000 && new Date(last.at).getTime() <= now.getTime();
    if (fresh && last.mood <= 4) {
      const ifThen = safe(task?.ifThen, task ? `começar por: ${safe(task.firstStep, 'o primeiro passo da tarefa')}` : 'voltar ao primeiro passo da tarefa');
      out.push({
        rule: 'risk_window',
        key: `risk_window:${day}:${now.getHours()}`,
        title: 'Momento de risco comum para você',
        body: `Seu plano: ${ifThen}. SOS disponível.`,
        route: '/sos',
      });
    }
  }

  const bed = data.profile ? minutesOf(data.profile.bedtimeTarget) : null;
  if (bed != null) {
    const target = (bed - 60 + 1440) % 1440;
    const since = (nowMin - target + 1440) % 1440;
    if (since < 30) {
      out.push({
        rule: 'bedtime',
        key: `bedtime:${day}`,
        title: 'Uma hora para dormir',
        body: `Hora de desligar as telas de lazer. Alvo: ${data.profile!.bedtimeTarget}.`,
        route: '/revisao',
      });
    }
  }

  return out.sort((a, b) => PRIORITY.indexOf(a.rule) - PRIORITY.indexOf(b.rule));
}

/**
 * Decide o que disparar agora. Puro: mesma entrada, mesma saída.
 * Regras: silêncio 23h–8h, máx. 3 por dia (metade com abertura < 20% em 7 dias),
 * cada ponto de decisão dispara uma vez só.
 */
export function decide(data: AppData, now: Date): Decision[] {
  if (isQuiet(now)) return [];
  const day = dayKey(now);
  const logs = data.notifications;
  const sentToday = logs.filter((l) => l.delivered && dayKey(l.at) === day).length;
  const budget = dailyLimit(logs, now) - sentToday;
  if (budget <= 0) return [];
  const seen = new Set(logs.map((l) => l.rule));
  const recentRules = new Set(logs.filter((l) => now.getTime() - new Date(l.at).getTime() < 60 * 60_000).map(ruleOf));
  return candidates(data, now)
    .filter((d) => !seen.has(d.key))
    // nunca duas do mesmo tipo dentro de 1 h (ex.: dois blocos seguidos)
    .filter((d) => !recentRules.has(d.rule))
    .slice(0, Math.min(budget, 1));
}

/* ---------- runtime ---------- */

type Log = (n: NotificationLog) => void;

function openRoute(route: string) {
  window.focus();
  if (location.pathname + location.search === route) return;
  window.history.pushState({}, '', route);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function canNotify(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
}

async function show(d: Decision, entry: NotificationLog, log: Log): Promise<boolean> {
  const options: NotificationOptions = { body: d.body, tag: d.key, icon: '/icon-192.png', badge: '/icon-192.png', data: { id: entry.id, route: d.route } };
  const markOpened = () => {
    log({ ...entry, delivered: true, opened: true });
    openRoute(d.route);
  };
  try {
    const n = new Notification(d.title, options);
    n.onclick = () => {
      markOpened();
      n.close();
    };
    return true;
  } catch {
    // Android/Chrome exige o service worker para mostrar notificações.
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (!reg) return false;
    await reg.showNotification(d.title, options);
    return true;
  }
}

/**
 * Verifica a cada minuto e dispara as decisões. Retorna a função que para o runtime.
 * `log` padrão grava em `notifications` pelo store.
 */
export function startJitai(getData: () => AppData, log: Log): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    const data = getData();
    if (!data.settings.notificationsEnabled || !canNotify()) return;
    running = true;
    try {
      for (const d of decide(data, new Date())) {
        const entry: NotificationLog = { id: uid(), at: new Date().toISOString(), rule: d.key, delivered: false, opened: false };
        const delivered = await show(d, entry, log).catch(() => false);
        log({ ...entry, delivered });
      }
    } finally {
      running = false;
    }
  };
  void tick();
  const t = setInterval(() => void tick(), 60_000);
  const onVisible = () => document.visibilityState === 'visible' && void tick();
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    clearInterval(t);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
