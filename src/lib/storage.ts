import Dexie, { type Table } from 'dexie';
import { deriveKey, generateDeviceKey, open, randomBytes, seal, type Sealed } from './crypto';
import type { AppData, CollectionKey } from './types';
import { emptyData } from './defaults';

interface KvRow extends Sealed {
  key: CollectionKey;
}

interface MetaRow {
  key: 'vault';
  mode: 'device' | 'pin';
  deviceKey?: CryptoKey;
  salt?: Uint8Array;
  verifier: Sealed;
}

class RumoDB extends Dexie {
  kv!: Table<KvRow, CollectionKey>;
  meta!: Table<MetaRow, 'vault'>;
  constructor() {
    super('rumo');
    this.version(1).stores({ kv: 'key', meta: 'key' });
  }
}

const db = new RumoDB();
let activeKey: CryptoKey | null = null;
const VERIFIER = 'rumo-ok';

export type VaultStatus = 'new' | 'locked' | 'ready';

export async function initVault(): Promise<VaultStatus> {
  const meta = await db.meta.get('vault');
  if (!meta) return 'new';
  if (meta.mode === 'device' && meta.deviceKey) {
    activeKey = meta.deviceKey;
    return 'ready';
  }
  return 'locked';
}

/** Cria o cofre com chave do aparelho (sem PIN). */
export async function createVault(): Promise<void> {
  const deviceKey = await generateDeviceKey();
  const verifier = await seal(deviceKey, VERIFIER);
  await db.meta.put({ key: 'vault', mode: 'device', deviceKey, verifier });
  activeKey = deviceKey;
}

export async function unlock(pin: string): Promise<boolean> {
  const meta = await db.meta.get('vault');
  if (!meta || meta.mode !== 'pin' || !meta.salt) return false;
  const key = await deriveKey(pin, meta.salt);
  try {
    const v = await open<string>(key, meta.verifier);
    if (v !== VERIFIER) return false;
    activeKey = key;
    return true;
  } catch {
    return false;
  }
}

export function lockNow() {
  activeKey = null;
}

export async function hasPin(): Promise<boolean> {
  const meta = await db.meta.get('vault');
  return meta?.mode === 'pin';
}

/** Define (pin string) ou remove (null) o PIN, recifrando tudo. */
export async function setPin(pin: string | null): Promise<void> {
  const data = await loadAll();
  let key: CryptoKey;
  let row: MetaRow;
  if (pin) {
    const salt = randomBytes(16);
    key = await deriveKey(pin, salt);
    row = { key: 'vault', mode: 'pin', salt, verifier: await seal(key, VERIFIER) };
  } else {
    key = await generateDeviceKey();
    row = { key: 'vault', mode: 'device', deviceKey: key, verifier: await seal(key, VERIFIER) };
  }
  activeKey = key;
  await db.transaction('rw', db.kv, db.meta, async () => {
    await db.meta.put(row);
    for (const k of Object.keys(data) as CollectionKey[]) {
      await db.kv.put({ key: k, ...(await seal(key, data[k])) });
    }
  });
}

export async function loadAll(): Promise<AppData> {
  if (!activeKey) throw new Error('Cofre trancado');
  const out = emptyData();
  const rows = await db.kv.toArray();
  for (const row of rows) {
    try {
      (out as unknown as Record<string, unknown>)[row.key] = await open(activeKey, row);
    } catch {
      // linha ilegível: mantém o padrão em vez de travar o app
    }
  }
  return { ...emptyData(), ...out, settings: { ...emptyData().settings, ...out.settings } };
}

export async function saveCollection<K extends CollectionKey>(key: K, value: AppData[K]): Promise<void> {
  if (!activeKey) return;
  await db.kv.put({ key, ...(await seal(activeKey, value)) });
}

export async function wipeAll(): Promise<void> {
  activeKey = null;
  await db.delete();
  await db.open();
}
