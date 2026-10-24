// Modelo de dados (seção 4.4 do documento-fonte), com pequenos acréscimos de app.
export type ID = string;

export type EscapeType = 'games' | 'social' | 'sexual' | 'side_projects' | 'video' | 'other';

export interface EscapeMapEntry {
  type: EscapeType;
  when: string; // horário típico, texto livre ("depois do almoço")
  where: string; // local típico
  goal: string; // meta funcional definida pelo usuário
}

export interface Contacts {
  psychology?: string; // serviço de psicologia da universidade
  psychiatrist?: string;
  trusted?: string; // alguém de confiança
}

export interface UserProfile {
  id: ID;
  createdAt: string;
  name?: string;
  values: string[];
  escapes: EscapeMapEntry[];
  focusDefaults: { workMin: number; breakMin: number };
  bedtimeTarget: string; // "23:30"
  timezone: string;
  altActions: string[]; // cardápio editável do SOS
  rewards: string[]; // recompensas curtas sugeridas
  blockersChecklist: Record<string, boolean>; // configuração de bloqueios no SO
  contacts: Contacts;
  onboardedAt?: string;
}

export interface CheckIn {
  id: ID;
  at: string;
  kind: 'morning' | 'evening' | 'prompt';
  mood: number; // 0-10
  energy: number; // 0-10
  stress?: number;
  loneliness?: number;
  sleepHours?: number;
  location?: 'home' | 'campus' | 'library' | 'other';
}

export type TaskArea = 'academic' | 'life' | 'health';
export type TaskStatus = 'todo' | 'doing' | 'done' | 'dropped';

export interface Task {
  id: ID;
  title: string;
  area: TaskArea;
  firstStep: string; // primeiro passo físico de ≤5 min
  ifThen?: string; // "Se [hora/local], então [passo]"
  due?: string;
  aversiveness: number; // 0-10
  status: TaskStatus;
  createdAt: string;
  doneAt?: string;
}

export interface Woop {
  wish: string;
  outcome: string;
  obstacle: string;
  plan: string;
}

export interface DayPlan {
  date: string; // YYYY-MM-DD
  priorities: ID[]; // até 3, 1 acadêmica obrigatória
  antiEscapePlans: string[];
  woop?: Woop;
  plannedBlocks?: string[]; // horários "HH:MM"
}

export interface FocusSession {
  id: ID;
  taskId?: ID;
  start: string;
  end?: string;
  plannedMin: number;
  breakMin: number;
  completed: boolean;
  abandonedReason?: string;
  focusRating?: number;
  distractionsTapped: number;
  envChecklist: boolean[];
  reward?: string;
}

export type UrgeTool = 'surf' | 'delay' | 'alt_action' | 'breath';

export interface UrgeEvent {
  id: ID;
  at: string;
  type: EscapeType;
  intensityBefore: number;
  intensityAfter?: number;
  toolsUsed: UrgeTool[];
  altAction?: string;
  outcome: 'resisted' | 'lapsed' | 'unknown';
}

export interface LapseChain {
  vulnerabilities: string[];
  trigger: string;
  thoughts: string;
  behavior: string;
  shortTermConsequence: string;
  longTermConsequence: string;
  newIfThen: string;
}

export interface Lapse {
  id: ID;
  at: string;
  type: EscapeType;
  minutes?: number;
  chain?: LapseChain;
  selfCompassionNote?: string;
}

export interface AvoidedProblem {
  id: ID;
  title: string;
  discomfort: number; // 0-10
  costOfDelay: string;
  costScore: number; // 0-10, para ordenar custo × desconforto
  pst?: { definition: string; options: string[]; chosen: string; steps: string[] };
  smallestStep: string;
  scheduledFor?: string;
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
  resolvedAt?: string;
  minutesSpent?: number;
}

export interface HealthLog {
  date: string; // YYYY-MM-DD
  bedtime?: string; // "HH:MM"
  wake?: string;
  exerciseMin?: number;
}

export interface Screening {
  id: ID;
  at: string;
  instrument: 'PHQ9' | 'GAD7' | 'PHQ2' | 'GAD2';
  score: number;
  item9?: number;
  answers?: number[];
}

export interface NotificationLog {
  id: ID;
  at: string;
  rule: string;
  delivered: boolean;
  opened: boolean;
}

export interface Review {
  id: ID;
  at: string;
  kind: 'evening' | 'weekly';
  win?: string;
  worked?: string;
  tomorrowIfThen?: string;
  bedtime?: string;
  selfCompassion?: string;
  notes?: string;
  valuesReflection?: string;
}

export type ThemePref = 'auto' | 'day' | 'night';

export interface Settings {
  theme: ThemePref;
  discreet: boolean; // rótulos neutros ("Impulso S")
  lockAfterMin: number; // 0 = nunca
  notificationsEnabled: boolean;
  reducedMotion: boolean;
}

// Formato completo persistido (uma coleção por chave, cifradas).
export interface AppData {
  profile: UserProfile | null;
  checkins: CheckIn[];
  tasks: Task[];
  dayPlans: DayPlan[];
  focusSessions: FocusSession[];
  urges: UrgeEvent[];
  lapses: Lapse[];
  problems: AvoidedProblem[];
  health: HealthLog[];
  screenings: Screening[];
  notifications: NotificationLog[];
  reviews: Review[];
  settings: Settings;
}

export type CollectionKey = keyof AppData;
