import { create } from 'zustand';
import * as vault from '@/lib/storage';
import { emptyData } from '@/lib/defaults';
import type { AppData, CollectionKey, ID, Settings, UserProfile } from '@/lib/types';

type ArrayKeys = {
  [K in CollectionKey]: AppData[K] extends Array<infer _> ? K : never;
}[CollectionKey];
type ItemOf<K extends ArrayKeys> = AppData[K] extends Array<infer T> ? T : never;

export type Status = 'booting' | 'locked' | 'ready' | 'error';

interface AppState {
  status: Status;
  data: AppData;
  lastActivity: number;
  boot: () => Promise<void>;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
  /** Substitui uma coleção inteira via função. */
  mutate: <K extends CollectionKey>(key: K, fn: (prev: AppData[K]) => AppData[K]) => void;
  /** Insere ou atualiza por `id` (ou `date` em dayPlans/health). */
  upsert: <K extends ArrayKeys>(key: K, item: ItemOf<K>) => void;
  remove: <K extends ArrayKeys>(key: K, id: ID) => void;
  setProfile: (patch: Partial<UserProfile>) => void;
  setSettings: (patch: Partial<Settings>) => void;
  importData: (data: AppData) => Promise<void>;
  wipe: () => Promise<void>;
  touch: () => void;
}

const timers = new Map<CollectionKey, ReturnType<typeof setTimeout>>();
function persist<K extends CollectionKey>(key: K, value: AppData[K]) {
  clearTimeout(timers.get(key));
  timers.set(
    key,
    setTimeout(() => {
      void vault.saveCollection(key, value);
    }, 120),
  );
}

function identity(item: unknown): string {
  const o = item as { id?: string; date?: string };
  return o.id ?? o.date ?? '';
}

export const useApp = create<AppState>((set, get) => ({
  status: 'booting',
  data: emptyData(),
  lastActivity: Date.now(),

  boot: async () => {
    try {
      let s = await vault.initVault();
      if (s === 'new') {
        await vault.createVault();
        s = 'ready';
      }
      if (s === 'locked') return set({ status: 'locked' });
      set({ data: await vault.loadAll(), status: 'ready', lastActivity: Date.now() });
    } catch (e) {
      console.error(e);
      set({ status: 'error' });
    }
  },

  unlock: async (pin) => {
    const ok = await vault.unlock(pin);
    if (ok) set({ data: await vault.loadAll(), status: 'ready', lastActivity: Date.now() });
    return ok;
  },

  lock: () => {
    vault.lockNow();
    set({ status: 'locked', data: emptyData() });
  },

  mutate: (key, fn) => {
    const next = fn(get().data[key]);
    set((s) => ({ data: { ...s.data, [key]: next } }));
    persist(key, next);
  },

  upsert: (key, item) => {
    get().mutate(key, (prev) => {
      const arr = prev as unknown[];
      const id = identity(item);
      const i = arr.findIndex((x) => identity(x) === id);
      if (i === -1) return [...arr, item] as AppData[typeof key];
      const copy = arr.slice();
      copy[i] = item;
      return copy as AppData[typeof key];
    });
  },

  remove: (key, id) => {
    get().mutate(key, (prev) => (prev as unknown[]).filter((x) => identity(x) !== id) as AppData[typeof key]);
  },

  setProfile: (patch) => {
    const prev = get().data.profile;
    if (!prev) return;
    get().mutate('profile', () => ({ ...prev, ...patch }));
  },

  setSettings: (patch) => get().mutate('settings', (prev) => ({ ...prev, ...patch })),

  importData: async (data) => {
    const merged = { ...emptyData(), ...data };
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
    set({ data: merged });
    for (const k of Object.keys(merged) as CollectionKey[]) await vault.saveCollection(k, merged[k]);
  },

  wipe: async () => {
    await vault.wipeAll();
    await vault.createVault();
    set({ data: emptyData(), status: 'ready' });
  },

  touch: () => set({ lastActivity: Date.now() }),
}));

/** Atalho para ler dados com seletor. */
export function useData<T>(sel: (d: AppData) => T): T {
  return useApp((s) => sel(s.data));
}
