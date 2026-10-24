import type { Screening } from './types';
import { addDays } from './utils';

export type Instrument = 'PHQ9' | 'GAD7';

/** Opções de resposta (0–3), iguais nos dois instrumentos. */
export const ANSWERS = ['Nenhuma vez', 'Vários dias', 'Mais da metade dos dias', 'Quase todos os dias'] as const;

export const STEM = 'Nas últimas 2 semanas, com que frequência você foi incomodado/a por:';

/** PHQ-9, versão oficial em português do Brasil (Pfizer; validada por Santos et al., 2013). */
export const PHQ9_ITEMS = [
  'Pouco interesse ou pouco prazer em fazer as coisas',
  'Se sentir “para baixo”, deprimido/a ou sem perspectiva',
  'Dificuldade para pegar no sono ou permanecer dormindo, ou dormir mais do que de costume',
  'Se sentir cansado/a ou com pouca energia',
  'Falta de apetite ou comendo demais',
  'Se sentir mal consigo mesmo/a — ou achar que você é um fracasso ou que decepcionou sua família ou você mesmo/a',
  'Dificuldade para se concentrar nas coisas, como ler o jornal ou ver televisão',
  'Lentidão para se movimentar ou falar, a ponto das outras pessoas perceberem. Ou o oposto: estar tão agitado/a ou irrequieto/a que você fica andando de um lado para o outro muito mais do que de costume',
  'Pensar em se ferir de alguma maneira ou que seria melhor estar morto/a',
] as const;

/** GAD-7, versão oficial em português do Brasil (Pfizer). */
export const GAD7_ITEMS = [
  'Sentir-se nervoso/a, ansioso/a ou muito tenso/a',
  'Não ser capaz de impedir ou de controlar as preocupações',
  'Preocupar-se muito com diversas coisas',
  'Dificuldade para relaxar',
  'Ficar tão agitado/a que se torna difícil permanecer sentado/a',
  'Ficar facilmente aborrecido/a ou irritado/a',
  'Sentir medo como se algo horrível fosse acontecer',
] as const;

export const INSTRUMENTS: Record<Instrument, { name: string; about: string; items: readonly string[]; max: number }> = {
  PHQ9: { name: 'PHQ-9', about: 'Humor e sintomas de depressão', items: PHQ9_ITEMS, max: 27 },
  GAD7: { name: 'GAD-7', about: 'Ansiedade', items: GAD7_ITEMS, max: 21 },
};

export type Band = 'minimo' | 'leve' | 'moderado' | 'moderadamente_grave' | 'grave';

export const BAND_LABELS: Record<Band, string> = {
  minimo: 'Mínimo',
  leve: 'Leve',
  moderado: 'Moderado',
  moderadamente_grave: 'Moderadamente grave',
  grave: 'Grave',
};

export function score(answers: readonly number[]): number {
  return answers.reduce((a, b) => a + clampAnswer(b), 0);
}

function clampAnswer(v: number): number {
  return Number.isFinite(v) ? Math.min(3, Math.max(0, Math.round(v))) : 0;
}

/** Faixas: PHQ-9 0–4, 5–9, 10–14, 15–19, 20–27; GAD-7 0–4, 5–9, 10–14, 15–21. */
export function band(instrument: Instrument, s: number): Band {
  if (s <= 4) return 'minimo';
  if (s <= 9) return 'leve';
  if (s <= 14) return 'moderado';
  if (instrument === 'GAD7') return 'grave';
  return s <= 19 ? 'moderadamente_grave' : 'grave';
}

export function bandLabel(instrument: Instrument, s: number): string {
  return BAND_LABELS[band(instrument, s)];
}

export interface Alert {
  /** Item 9 do PHQ-9 > 0: tela de apoio imediata. */
  urgent: boolean;
  /** PHQ-9 ≥ 15 ou GAD-7 ≥ 15: recomendar profissional. */
  seekProfessional: boolean;
}

/** Regras da seção 4.9 do documento-fonte. */
export function alerts(instrument: Instrument, answers: readonly number[]): Alert {
  const s = score(answers);
  const urgent = instrument === 'PHQ9' && clampAnswer(answers[8] ?? 0) > 0;
  return { urgent, seekProfessional: s >= 15 };
}

export function buildScreening(instrument: Instrument, answers: readonly number[], id: string, at = new Date()): Screening {
  const clean = answers.map(clampAnswer);
  return {
    id,
    at: at.toISOString(),
    instrument,
    score: score(clean),
    answers: clean,
    ...(instrument === 'PHQ9' ? { item9: clean[8] ?? 0 } : {}),
  };
}

export const SCREENING_INTERVAL_DAYS = 30;

export function lastScreening(list: readonly Screening[], instrument: Instrument): Screening | undefined {
  return list
    .filter((s) => s.instrument === instrument)
    .reduce<Screening | undefined>((best, s) => (!best || s.at > best.at ? s : best), undefined);
}

/** Data em que a próxima triagem mensal fica devida. `null` = nunca feita (devida já). */
export function nextScreeningDue(list: readonly Screening[], instrument: Instrument): Date | null {
  const last = lastScreening(list, instrument);
  return last ? addDays(new Date(last.at), SCREENING_INTERVAL_DAYS) : null;
}

export function isScreeningDue(list: readonly Screening[], instrument: Instrument, now = new Date()): boolean {
  const due = nextScreeningDue(list, instrument);
  return !due || due.getTime() <= now.getTime();
}
