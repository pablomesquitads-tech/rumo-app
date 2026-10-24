import type { AppData, EscapeType, Settings, UserProfile } from './types';

export const ESCAPE_LABELS: Record<EscapeType, { label: string; discreet: string }> = {
  games: { label: 'Jogos', discreet: 'Impulso J' },
  social: { label: 'Redes sociais', discreet: 'Impulso R' },
  sexual: { label: 'Pornografia / masturbação', discreet: 'Impulso S' },
  side_projects: { label: 'Projetos paralelos', discreet: 'Impulso P' },
  video: { label: 'Vídeos / séries', discreet: 'Impulso V' },
  other: { label: 'Outro', discreet: 'Impulso O' },
};

export const ESCAPE_ORDER: EscapeType[] = ['games', 'social', 'sexual', 'side_projects', 'video', 'other'];

export function escapeLabel(t: EscapeType, discreet: boolean): string {
  return discreet ? ESCAPE_LABELS[t].discreet : ESCAPE_LABELS[t].label;
}

export const DEFAULT_ALT_ACTIONS = [
  'Caminhar 10 minutos',
  '15 flexões ou agachamentos',
  'Banho rápido',
  'Mudar de cômodo',
  'Chamar alguém',
  'Beber água e lavar o rosto',
];

export const DEFAULT_REWARDS = ['Café', 'Uma música', '5 min ao ar livre', 'Um lanche', 'Alongar'];

export const FOCUS_PRESETS = [
  { workMin: 12, breakMin: 3 },
  { workMin: 24, breakMin: 6 },
  { workMin: 25, breakMin: 5 },
  { workMin: 50, breakMin: 10 },
] as const;

export const DEFAULT_SETTINGS: Settings = {
  theme: 'auto',
  discreet: false,
  lockAfterMin: 0,
  notificationsEnabled: false,
  reducedMotion: false,
};

export function defaultProfile(): UserProfile {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    values: [],
    escapes: [],
    focusDefaults: { workMin: 25, breakMin: 5 },
    bedtimeTarget: '23:30',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    altActions: [...DEFAULT_ALT_ACTIONS],
    rewards: [...DEFAULT_REWARDS],
    blockersChecklist: {},
    contacts: {},
  };
}

export function emptyData(): AppData {
  return {
    profile: null,
    checkins: [],
    tasks: [],
    dayPlans: [],
    focusSessions: [],
    urges: [],
    lapses: [],
    problems: [],
    health: [],
    screenings: [],
    notifications: [],
    reviews: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export const HELP = {
  cvv: { label: 'CVV', number: '188', note: 'Apoio emocional, 24 h, ligação gratuita' },
  samu: { label: 'SAMU', number: '192', note: 'Emergência médica' },
};
