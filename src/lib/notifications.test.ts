import { describe, expect, it } from 'vitest';
import type { AppData, NotificationLog } from './types';
import { defaultProfile, emptyData, ESCAPE_LABELS } from './defaults';
import { candidates, dailyLimit, decide, isQuiet, isSensitive } from './notifications';

const L = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m);
const iso = (d: number, h: number, m = 0) => L(d, h, m).toISOString();

function base(p: Partial<AppData> = {}): AppData {
  const data = emptyData();
  data.profile = { ...defaultProfile(), bedtimeTarget: '23:30', onboardedAt: iso(1, 9) };
  data.settings.notificationsEnabled = true;
  data.tasks = [
    {
      id: 't1',
      title: 'Lista 3 de Cálculo',
      area: 'academic',
      firstStep: 'abrir o PDF da lista 3',
      ifThen: 'Se forem 14h e eu estiver na biblioteca, então abro o PDF da lista 3',
      aversiveness: 7,
      status: 'todo',
      createdAt: iso(20, 8),
    },
  ];
  data.dayPlans = [{ date: '2026-10-20', priorities: ['t1'], antiEscapePlans: [], plannedBlocks: ['14:00', '16:00'] }];
  return { ...data, ...p };
}

function sent(at: string, rule: string, opened = false): NotificationLog {
  return { id: at + rule, at, rule, delivered: true, opened };
}

/** Lapsos às 21h em vários dias: a janela de risco aprendida. */
function withRisk(data: AppData, mood: number, checkAt = iso(20, 19, 30)): AppData {
  data.lapses = [15, 16, 17, 18].map((d) => ({ id: `l${d}`, at: iso(d, 21, 10), type: 'sexual' as const }));
  data.checkins = [{ id: 'c1', at: checkAt, kind: 'prompt', mood, energy: 5 }];
  return data;
}

describe('5 min antes do bloco planejado', () => {
  it('dispara entre 5 e 1 min antes', () => {
    const d = decide(base(), L(20, 13, 56));
    expect(d).toHaveLength(1);
    expect(d[0].rule).toBe('pre_block');
    expect(d[0].route).toContain('/foco');
    expect(d[0].route).toContain('task=t1');
  });
  it('não dispara 6 min antes nem na hora', () => {
    expect(decide(base(), L(20, 13, 54))).toHaveLength(0);
    expect(decide(base(), L(20, 14, 0)).filter((x) => x.rule === 'pre_block')).toHaveLength(0);
  });
  it('não repete o mesmo ponto de decisão', () => {
    const data = base({ notifications: [sent(iso(20, 13, 55), 'pre_block:2026-10-20:14:00')] });
    expect(decide(data, L(20, 13, 57))).toHaveLength(0);
  });
  it('não dispara com um bloco em andamento', () => {
    const data = base({
      focusSessions: [{ id: 's', start: iso(20, 13, 40), plannedMin: 25, breakMin: 5, completed: false, distractionsTapped: 0, envChecklist: [] }],
    });
    expect(decide(data, L(20, 13, 56))).toHaveLength(0);
  });
});

describe('10 min após bloco não iniciado', () => {
  it('oferece um bloco de 12 min', () => {
    const d = decide(base(), L(20, 14, 10));
    expect(d[0].rule).toBe('missed_block');
    expect(d[0].title).toBe('Quer um bloco de 12 min?');
    expect(d[0].route).toContain('min=12');
  });
  it('nada antes de 10 min', () => {
    expect(decide(base(), L(20, 14, 9))).toHaveLength(0);
  });
  it('nada se o bloco começou (mesmo um pouco antes)', () => {
    const data = base({
      focusSessions: [{ id: 's', start: iso(20, 13, 52), plannedMin: 12, breakMin: 3, completed: true, end: iso(20, 14, 4), distractionsTapped: 0, envChecklist: [] }],
    });
    expect(decide(data, L(20, 14, 12))).toHaveLength(0);
  });
});

describe('janela de risco', () => {
  it('dispara com humor ≤ 4 no check-in das últimas 3 h', () => {
    const d = decide(withRisk(base(), 4), L(20, 21, 5));
    expect(d).toHaveLength(1);
    expect(d[0].rule).toBe('risk_window');
    expect(d[0].title).toBe('Momento de risco comum para você');
    expect(d[0].body).toBe('Seu plano: Se forem 14h e eu estiver na biblioteca, então abro o PDF da lista 3. SOS disponível.');
    expect(d[0].route).toBe('/sos');
  });
  it('não dispara com humor 5', () => {
    expect(decide(withRisk(base(), 5), L(20, 21, 5))).toHaveLength(0);
  });
  it('não dispara com check-in de mais de 3 h', () => {
    expect(decide(withRisk(base(), 2, iso(20, 17, 59)), L(20, 21, 5))).toHaveLength(0);
  });
  it('não dispara fora da janela', () => {
    expect(decide(withRisk(base(), 2), L(20, 20, 5))).toHaveLength(0);
  });
});

describe('60 min antes de dormir', () => {
  it('lembra de desligar telas de lazer', () => {
    const d = decide(base(), L(20, 22, 35));
    expect(d[0].rule).toBe('bedtime');
    expect(d[0].body).toContain('telas de lazer');
  });
  it('alvo depois da meia-noite cai no silêncio', () => {
    const data = base();
    data.profile!.bedtimeTarget = '00:30';
    expect(candidates(data, L(20, 23, 35)).some((c) => c.rule === 'bedtime')).toBe(true);
    expect(decide(data, L(20, 23, 35))).toHaveLength(0);
  });
});

describe('silêncio 23h–8h', () => {
  it('limites', () => {
    expect(isQuiet(L(20, 22, 59))).toBe(false);
    expect(isQuiet(L(20, 23, 0))).toBe(true);
    expect(isQuiet(L(20, 3, 0))).toBe(true);
    expect(isQuiet(L(20, 7, 59))).toBe(true);
    expect(isQuiet(L(20, 8, 0))).toBe(false);
  });
  it('nada dispara de madrugada, mesmo com bloco planejado', () => {
    const data = base();
    data.dayPlans[0].plannedBlocks = ['07:30'];
    expect(decide(data, L(20, 7, 27))).toHaveLength(0);
  });
});

describe('máximo de 3 por dia', () => {
  it('a quarta não sai', () => {
    const data = base({
      notifications: [sent(iso(20, 9), 'x:1', true), sent(iso(20, 10), 'x:2', true), sent(iso(20, 11), 'x:3', true)],
    });
    expect(decide(data, L(20, 13, 56))).toHaveLength(0);
  });
  it('as de ontem não contam', () => {
    const data = base({
      notifications: [sent(iso(19, 9), 'x:1', true), sent(iso(19, 10), 'x:2', true), sent(iso(19, 11), 'x:3', true)],
    });
    expect(decide(data, L(20, 13, 56))).toHaveLength(1);
  });
  it('simulando um dia inteiro, nunca passa de 3', () => {
    const data = withRisk(base(), 2, iso(20, 20, 0));
    data.dayPlans[0].plannedBlocks = ['09:00', '11:00', '14:00', '16:00', '18:00', '20:00'];
    for (let m = 0; m < 24 * 60; m++) {
      const now = L(20, 0, m);
      for (const d of decide(data, now)) data.notifications.push({ id: `${m}`, at: now.toISOString(), rule: d.key, delivered: true, opened: true });
    }
    expect(data.notifications).toHaveLength(3);
    data.notifications.forEach((n) => expect(isQuiet(new Date(n.at))).toBe(false));
  });
});

describe('anti-fadiga', () => {
  const ignored = (n: number, opened: number) =>
    Array.from({ length: n }, (_, i) => sent(iso(14 + (i % 6), 10 + (i % 4)), `old:${i}`, i < opened));

  it('abertura < 20% em 7 dias reduz o limite pela metade', () => {
    expect(dailyLimit(ignored(10, 1), L(20, 12))).toBe(1);
  });
  it('abertura ≥ 20% mantém 3', () => {
    expect(dailyLimit(ignored(10, 2), L(20, 12))).toBe(3);
  });
  it('poucos envios ainda não contam como sinal', () => {
    expect(dailyLimit(ignored(4, 0), L(20, 12))).toBe(3);
  });
  it('com o limite reduzido, a segunda do dia não sai', () => {
    const data = base({ notifications: [...ignored(10, 0), sent(iso(20, 9), 'x:1')] });
    expect(decide(data, L(20, 13, 56))).toHaveLength(0);
  });
});

describe('sem conteúdo sensível', () => {
  it('nenhum texto cita o tipo de fuga', () => {
    const data = withRisk(base(), 1, iso(20, 20, 50));
    const times = [L(20, 13, 56), L(20, 14, 12), L(20, 21, 5), L(20, 22, 35)];
    const all = times.flatMap((t) => candidates(data, t));
    expect(all.map((c) => c.rule).sort()).toEqual(['bedtime', 'missed_block', 'pre_block', 'risk_window']);
    for (const c of all) {
      expect(isSensitive(`${c.title} ${c.body}`)).toBe(false);
      for (const l of Object.values(ESCAPE_LABELS)) {
        expect(`${c.title} ${c.body} ${c.route}`.toLowerCase()).not.toContain(l.label.toLowerCase());
        expect(`${c.title} ${c.body}`).not.toContain(l.discreet);
      }
    }
  });
  it('plano do usuário com termo sensível é trocado por texto neutro', () => {
    const data = withRisk(base(), 2);
    data.tasks[0].ifThen = 'Se bater vontade de pornografia, então saio do quarto';
    const d = decide(data, L(20, 21, 5));
    expect(d[0].body).not.toMatch(/porn/i);
    expect(d[0].body).toContain('abrir o PDF da lista 3');
  });
  it('detecta rótulos com e sem acento', () => {
    expect(isSensitive('masturbação')).toBe(true);
    expect(isSensitive('Masturbacao')).toBe(true);
    expect(isSensitive('Redes sociais')).toBe(true);
    expect(isSensitive('abrir o PDF da lista 3')).toBe(false);
  });
});
