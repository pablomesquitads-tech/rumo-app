// Conta e sincronização na nuvem (Firebase Auth + Firestore).
// O Firestore só recebe blobs AES-GCM: a chave sai de PBKDF2(senha, uid) e nunca deixa o aparelho.
import Dexie, { type Table } from 'dexie';
import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import {
  Bytes,
  collection,
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { deriveKey, open, seal } from './crypto';
import type { AppData, CollectionKey } from './types';

const app = initializeApp({
  apiKey: 'AIzaSyCbi_W0jCQlQMWvzaJWvRz8no6pKcTHdUI',
  authDomain: 'rumo-app-pyms.firebaseapp.com',
  projectId: 'rumo-app-pyms',
  storageBucket: 'rumo-app-pyms.firebasestorage.app',
  messagingSenderId: '481191027082',
  appId: '1:481191027082:web:927a77d9bed1d513cea873',
});
const auth = getAuth(app);
const fs = getFirestore(app);
const ready = setPersistence(auth, browserLocalPersistence);

interface KeyRow {
  uid: string;
  key: CryptoKey;
}
class KeyDB extends Dexie {
  keys!: Table<KeyRow, string>;
  constructor() {
    super('rumo-cloud');
    this.version(1).stores({ keys: 'uid' });
  }
}
const keyDb = new KeyDB();

let user: User | null = null;
let cloudKey: CryptoKey | null = null;

const enc = new TextEncoder();
function saltFor(uid: string) {
  return enc.encode(`rumo-cloud/${uid}`);
}

/** Resolve com o usuário atual (ou null) e a chave da nuvem guardada neste aparelho. */
export async function currentUser(): Promise<User | null> {
  await ready;
  const u = await new Promise<User | null>((resolve) => {
    const off = onAuthStateChanged(auth, (x) => {
      off();
      resolve(x);
    });
  });
  if (!u) return null;
  const row = await keyDb.keys.get(u.uid);
  if (!row) {
    // Sessão sem chave (dados do site limpos em parte): pede a senha de novo.
    await fbSignOut(auth);
    return null;
  }
  user = u;
  cloudKey = row.key;
  return u;
}

export type SignInError = 'credentials' | 'network' | 'too-many' | 'unknown';

export async function signIn(email: string, password: string): Promise<SignInError | null> {
  await ready;
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    const key = await deriveKey(password, saltFor(cred.user.uid));
    await keyDb.keys.put({ uid: cred.user.uid, key });
    user = cred.user;
    cloudKey = key;
    return null;
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(code)) return 'credentials';
    if (code.includes('network')) return 'network';
    if (code.includes('too-many-requests')) return 'too-many';
    console.error(e);
    return 'unknown';
  }
}

export async function signOut(): Promise<void> {
  stopSync();
  if (user) await keyDb.keys.delete(user.uid);
  user = null;
  cloudKey = null;
  await fbSignOut(auth);
}

export function accountEmail(): string | null {
  return user?.email ?? null;
}

// ---------- Sincronização ----------

interface CloudDoc {
  iv: Bytes;
  data: Bytes;
  rev: number;
}

const revs = new Map<CollectionKey, number>();
let unsub: Unsubscribe | null = null;

type ApplyRemote = <K extends CollectionKey>(key: K, value: AppData[K], rev: number) => void;

/**
 * Escuta a nuvem. Coleções mais novas lá são entregues a `apply`;
 * as mais novas aqui (ou que não existem lá) sobem.
 */
export function startSync(
  localRevs: Map<CollectionKey, number>,
  local: () => AppData,
  apply: ApplyRemote,
): void {
  if (!user || !cloudKey || unsub) return;
  localRevs.forEach((v, k) => revs.set(k, v));
  const key = cloudKey;
  let first = true;
  unsub = onSnapshot(
    collection(fs, 'users', user.uid, 'kv'),
    async (snap) => {
      for (const change of snap.docChanges()) {
        const k = change.doc.id as CollectionKey;
        if (change.type === 'removed' || change.doc.metadata.hasPendingWrites) continue;
        const d = change.doc.data() as CloudDoc;
        if (d.rev <= (revs.get(k) ?? 0)) continue;
        try {
          const value = await open<AppData[typeof k]>(key, {
            iv: d.iv.toUint8Array(),
            data: d.data.toUint8Array().slice().buffer,
          });
          revs.set(k, d.rev);
          apply(k, value, d.rev);
        } catch (e) {
          console.error('Não consegui abrir', k, e);
        }
      }
      if (first) {
        first = false;
        // Primeira leitura: sobe o que é só local ou mais novo aqui.
        const remote = new Map(snap.docs.map((x) => [x.id as CollectionKey, (x.data() as CloudDoc).rev]));
        const data = local();
        for (const k of Object.keys(data) as CollectionKey[]) {
          const lr = revs.get(k) ?? 0;
          if (lr > 0 && lr > (remote.get(k) ?? 0)) void push(k, data[k], lr);
        }
      }
    },
    (e) => console.error('Sync', e),
  );
}

export function stopSync() {
  unsub?.();
  unsub = null;
  revs.clear();
}

export async function push<K extends CollectionKey>(k: K, value: AppData[K], rev: number): Promise<void> {
  if (!user || !cloudKey) return;
  revs.set(k, rev);
  const s = await seal(cloudKey, value);
  try {
    await setDoc(doc(fs, 'users', user.uid, 'kv', k), {
      iv: Bytes.fromUint8Array(s.iv),
      data: Bytes.fromUint8Array(new Uint8Array(s.data)),
      rev,
    } satisfies CloudDoc);
  } catch (e) {
    console.error('Falha ao enviar', k, e);
  }
}
