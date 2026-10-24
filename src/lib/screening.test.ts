import { describe, expect, it } from 'vitest';
import {
  GAD7_ITEMS,
  PHQ9_ITEMS,
  alerts,
  band,
  buildScreening,
  isScreeningDue,
  nextScreeningDue,
  score,
} from './screening';
import type { Screening } from './types';

const phq = (n: number[]) => n;

describe('itens', () => {
  it('PHQ-9 tem 9 itens e GAD-7 tem 7', () => {
    expect(PHQ9_ITEMS).toHaveLength(9);
    expect(GAD7_ITEMS).toHaveLength(7);
  });
});

describe('score', () => {
  it('soma as respostas e limita cada uma a 0–3', () => {
    expect(score([0, 1, 2, 3])).toBe(6);
    expect(score([5, -1, 2.4])).toBe(5);
    expect(score([3, 3, 3, 3, 3, 3, 3, 3, 3])).toBe(27);
  });
});

describe('band', () => {
  it('PHQ-9 usa cinco faixas', () => {
    expect(band('PHQ9', 0)).toBe('minimo');
    expect(band('PHQ9', 4)).toBe('minimo');
    expect(band('PHQ9', 5)).toBe('leve');
    expect(band('PHQ9', 10)).toBe('moderado');
    expect(band('PHQ9', 15)).toBe('moderadamente_grave');
    expect(band('PHQ9', 19)).toBe('moderadamente_grave');
    expect(band('PHQ9', 20)).toBe('grave');
  });
  it('GAD-7 usa quatro faixas', () => {
    expect(band('GAD7', 4)).toBe('minimo');
    expect(band('GAD7', 9)).toBe('leve');
    expect(band('GAD7', 14)).toBe('moderado');
    expect(band('GAD7', 15)).toBe('grave');
  });
});

describe('alerts', () => {
  it('item 9 > 0 é urgente mesmo com pontuação baixa', () => {
    expect(alerts('PHQ9', phq([0, 0, 0, 0, 0, 0, 0, 0, 1]))).toEqual({ urgent: true, seekProfessional: false });
  });
  it('PHQ-9 ≥ 15 recomenda profissional', () => {
    expect(alerts('PHQ9', phq([2, 2, 2, 2, 2, 2, 2, 1, 0]))).toEqual({ urgent: false, seekProfessional: true });
    expect(alerts('PHQ9', phq([2, 2, 2, 2, 2, 2, 2, 0, 0])).seekProfessional).toBe(false);
  });
  it('GAD-7 ≥ 15 recomenda profissional e nunca é urgente', () => {
    expect(alerts('GAD7', [3, 3, 3, 3, 3, 0, 0])).toEqual({ urgent: false, seekProfessional: true });
    expect(alerts('GAD7', [2, 2, 2, 2, 2, 2, 2])).toEqual({ urgent: false, seekProfessional: false });
  });
});

describe('buildScreening', () => {
  it('grava item9 só no PHQ-9', () => {
    const a = buildScreening('PHQ9', [1, 1, 1, 1, 1, 1, 1, 1, 2], 'x', new Date('2026-01-01T12:00:00Z'));
    expect(a).toMatchObject({ instrument: 'PHQ9', score: 10, item9: 2, at: '2026-01-01T12:00:00.000Z' });
    const b = buildScreening('GAD7', [1, 1, 1, 1, 1, 1, 1], 'y');
    expect(b.item9).toBeUndefined();
    expect(b.score).toBe(7);
  });
});

describe('nextScreeningDue', () => {
  const list: Screening[] = [
    { id: '1', at: '2026-01-01T10:00:00.000Z', instrument: 'PHQ9', score: 3 },
    { id: '2', at: '2026-02-10T10:00:00.000Z', instrument: 'PHQ9', score: 4 },
    { id: '3', at: '2026-01-20T10:00:00.000Z', instrument: 'GAD7', score: 2 },
  ];
  it('é null quando nunca foi feita', () => {
    expect(nextScreeningDue([], 'PHQ9')).toBeNull();
    expect(isScreeningDue([], 'GAD7')).toBe(true);
  });
  it('conta 30 dias a partir da mais recente de cada instrumento', () => {
    expect(nextScreeningDue(list, 'PHQ9')?.toISOString()).toBe('2026-03-12T10:00:00.000Z');
    expect(nextScreeningDue(list, 'GAD7')?.toISOString()).toBe('2026-02-19T10:00:00.000Z');
  });
  it('fica devida quando a data chega', () => {
    expect(isScreeningDue(list, 'PHQ9', new Date('2026-03-01T00:00:00Z'))).toBe(false);
    expect(isScreeningDue(list, 'PHQ9', new Date('2026-03-12T10:00:00Z'))).toBe(true);
  });
});
