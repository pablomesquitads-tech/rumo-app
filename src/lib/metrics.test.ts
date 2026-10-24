import { describe, expect, it } from 'vitest';
import type { FocusSession, Lapse, UrgeEvent } from './types';
import {
  daysWithinPlan,
  focusMovingAvg7,
  lapseHeatmap,
  plannedStartedRate,
  riskHours,
  sessionMinutes,
  sleepHours,
  urgeStats,
} from './metrics';

// Datas em horário local, como o app as produz.
const L = (d: number, h = 12, m = 0) => new Date(2026, 9, d, h, m);
const iso = (d: number, h = 12, m = 0) => L(d, h, m).toISOString();

function session(start: string, p: Partial<FocusSession> = {}): FocusSession {
  return { id: start, start, plannedMin: 25, breakMin: 5, completed: true, distractionsTapped: 0, envChecklist: [], ...p };
}
function urge(at: string, p: Partial<UrgeEvent> = {}): UrgeEvent {
  return { id: at + Math.random(), at, type: 'games', intensityBefore: 8, toolsUsed: [], outcome: 'resisted', ...p };
}
function lapse(at: string, p: Partial<Lapse> = {}): Lapse {
  return { id: at + Math.random(), at, type: 'games', ...p };
}

describe('sessionMinutes', () => {
  it('conta o planejado quando concluída', () => {
    expect(sessionMinutes(session(iso(10), { plannedMin: 50 }))).toBe(50);
  });
  it('conta o decorrido quando abandonada, limitado ao planejado', () => {
    expect(sessionMinutes(session(iso(10, 14), { completed: false, end: iso(10, 14, 9) }))).toBe(9);
    expect(sessionMinutes(session(iso(10, 14), { completed: false, end: iso(10, 16) }))).toBe(25);
  });
  it('zero quando em aberto', () => {
    expect(sessionMinutes(session(iso(10), { completed: false }))).toBe(0);
  });
  it('sessão que atravessa a meia-noite conta inteira', () => {
    expect(sessionMinutes(session(iso(10, 23, 50), { completed: false, end: iso(11, 0, 10) }))).toBe(20);
  });
});

describe('focusMovingAvg7', () => {
  it('divide por 7 mesmo com dias vazios', () => {
    const data = { focusSessions: [session(iso(20)), session(iso(18)), session(iso(13))] };
    // 13 está fora da janela 14..20
    expect(focusMovingAvg7(data, L(20, 9))).toBe(Math.round(50 / 7));
  });
  it('sessão às 23:59 pertence ao próprio dia', () => {
    const data = { focusSessions: [session(iso(13, 23, 59), { plannedMin: 70 })] };
    expect(focusMovingAvg7(data, L(20, 0, 0))).toBe(0);
    expect(focusMovingAvg7(data, L(19, 23, 59))).toBe(10);
    expect(focusMovingAvg7(data, L(14, 0, 1))).toBe(10);
  });
});

describe('plannedStartedRate', () => {
  it('null sem blocos planejados', () => {
    expect(plannedStartedRate({ dayPlans: [], focusSessions: [] }, 7, L(20))).toBeNull();
  });
  it('limita iniciados ao planejado por dia', () => {
    const data = {
      dayPlans: [{ date: '2026-10-19', priorities: [], antiEscapePlans: [], plannedBlocks: ['09:00', '14:00'] }],
      focusSessions: [session(iso(19, 9)), session(iso(19, 14)), session(iso(19, 18))],
    };
    expect(plannedStartedRate(data, 7, L(20))).toBe(100);
  });
  it('ignora horários de hoje que ainda não chegaram', () => {
    const data = {
      dayPlans: [{ date: '2026-10-20', priorities: [], antiEscapePlans: [], plannedBlocks: ['09:00', '16:00'] }],
      focusSessions: [session(iso(20, 9, 2))],
    };
    expect(plannedStartedRate(data, 7, L(20, 10))).toBe(100);
    expect(plannedStartedRate(data, 7, L(20, 17))).toBe(50);
  });
});

describe('urgeStats', () => {
  it('null sem impulsos', () => {
    expect(urgeStats({ urges: [] }, 30, L(20))).toEqual({ total: 0, resisted: 0, resistedPct: null, avgDrop: null });
  });
  it('percentual resistido e queda média', () => {
    const urges = [
      urge(iso(20), { intensityAfter: 4 }),
      urge(iso(19), { intensityAfter: 7, outcome: 'lapsed' }),
      urge(iso(18), { outcome: 'unknown' }),
    ];
    const s = urgeStats({ urges }, 30, L(20));
    expect(s.total).toBe(3);
    expect(s.resistedPct).toBe(33);
    expect(s.avgDrop).toBe(2.5);
  });
  it('janela começa à meia-noite do primeiro dia, não na hora atual', () => {
    const urges = [urge(iso(14, 0, 5))];
    expect(urgeStats({ urges }, 7, L(20, 23)).total).toBe(1);
    expect(urgeStats({ urges: [urge(iso(13, 23, 59))] }, 7, L(20, 23)).total).toBe(0);
  });
});

describe('daysWithinPlan', () => {
  it('null quando não há atividade', () => {
    const r = daysWithinPlan({ focusSessions: [], lapses: [] }, 30, L(20));
    expect(r.pct).toBeNull();
    expect(r.marks).toHaveLength(30);
  });
  it('lapso analisado não tira o dia do plano; não analisado tira', () => {
    const data = {
      focusSessions: [session(iso(20)), session(iso(19)), session(iso(18))],
      lapses: [
        lapse(iso(19), { chain: { vulnerabilities: [], trigger: '', thoughts: '', behavior: '', shortTermConsequence: '', longTermConsequence: '', newIfThen: 'Se..., então...' } }),
        lapse(iso(18)),
      ],
    };
    const r = daysWithinPlan(data, 30, L(20));
    expect(r.marks.filter((m) => m.within).map((m) => m.date)).toEqual(['2026-10-19', '2026-10-20']);
    expect(r.pct).toBe(Math.round((2 / 30) * 100));
  });
  it('um lapso hoje não zera os dias anteriores (não é streak)', () => {
    const data = { focusSessions: [session(iso(18)), session(iso(19))], lapses: [lapse(iso(20))] };
    expect(daysWithinPlan(data, 30, L(20)).marks.filter((m) => m.within)).toHaveLength(2);
  });
  it('bloco concluído às 23:59 conta para aquele dia', () => {
    const r = daysWithinPlan({ focusSessions: [session(iso(19, 23, 59))], lapses: [] }, 30, L(20));
    expect(r.marks.find((m) => m.date === '2026-10-19')?.within).toBe(true);
    expect(r.marks.at(-1)?.within).toBe(false);
  });
});

describe('riskHours', () => {
  it('ordena por contagem e desempata pela hora', () => {
    const data = {
      lapses: [lapse(iso(19, 22)), lapse(iso(18, 22, 40)), lapse(iso(17, 15)), lapse(iso(16, 9))],
      urges: [],
    };
    expect(riskHours(data, L(20))).toEqual([22, 9]);
  });
  it('só as últimas 2 semanas', () => {
    const data = { lapses: [lapse(iso(6, 22))], urges: [urge(iso(7, 0, 10), { outcome: 'lapsed' })] };
    expect(riskHours(data, L(20, 23))).toEqual([0]);
  });
  it('SOS que virou registro de lapso não conta duas vezes', () => {
    const data = {
      lapses: [lapse(iso(19, 22, 20))],
      urges: [urge(iso(19, 22, 0), { outcome: 'lapsed' }), urge(iso(18, 15), { outcome: 'lapsed' }), urge(iso(17, 15), { outcome: 'lapsed' })],
    };
    expect(riskHours(data, L(20))).toEqual([15, 22]);
    expect(lapseHeatmap(data, 60, L(20)).get('games')?.reduce((a, b) => a + b, 0)).toBe(3);
  });
});

describe('sleepHours', () => {
  it('atravessa a meia-noite', () => {
    expect(sleepHours('23:30', '07:00')).toBe(7.5);
  });
  it('deitar depois da meia-noite', () => {
    expect(sleepHours('00:00', '08:00')).toBe(8);
    expect(sleepHours('01:15', '07:45')).toBe(6.5);
  });
  it('cochilo no mesmo dia', () => {
    expect(sleepHours('14:00', '14:45')).toBe(0.8);
  });
  it('null com dado faltando ou inválido', () => {
    expect(sleepHours(undefined, '07:00')).toBeNull();
    expect(sleepHours('23:00', '')).toBeNull();
    expect(sleepHours('xx', '07:00')).toBeNull();
  });
});
