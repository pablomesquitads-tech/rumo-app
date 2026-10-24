import type { AppData, CollectionKey, EscapeType } from './types';
import { defaultProfile, emptyData, escapeLabel, ESCAPE_LABELS } from './defaults';
import { dayKey } from './utils';

const FORMAT = 'rumo-backup';
const VERSION = 1;

export interface Backup {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
  data: AppData;
}

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function backupJSON(data: AppData, now = new Date()): string {
  const b: Backup = { format: FORMAT, version: VERSION, exportedAt: now.toISOString(), data };
  return JSON.stringify(b, null, 2);
}

export function exportJSON(data: AppData) {
  download(`rumo-${dayKey()}.json`, backupJSON(data), 'application/json');
}

/** Coleções que fazem sentido como planilha. */
export const CSV_COLLECTIONS = [
  { key: 'focusSessions', label: 'Blocos de foco' },
  { key: 'urges', label: 'Impulsos (SOS)' },
  { key: 'lapses', label: 'Lapsos' },
  { key: 'checkins', label: 'Check-ins' },
  { key: 'tasks', label: 'Tarefas' },
  { key: 'dayPlans', label: 'Planos do dia' },
  { key: 'problems', label: 'Problemas evitados' },
  { key: 'health', label: 'Sono e exercício' },
  { key: 'screenings', label: 'Triagens' },
  { key: 'reviews', label: 'Revisões' },
] as const satisfies readonly { key: CollectionKey; label: string }[];

export type CsvKey = (typeof CSV_COLLECTIONS)[number]['key'];

function cell(v: unknown): string {
  if (v == null) return '';
  let s: string;
  if (Array.isArray(v)) s = v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join('; ');
  else if (typeof v === 'object') s = JSON.stringify(v);
  else s = String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV simples: colunas = união das chaves, na ordem em que aparecem. */
export function toCSV(rows: readonly Record<string, unknown>[]): string {
  const cols: string[] = [];
  for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k);
  const lines = [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))];
  return lines.join('\r\n');
}

function isEscape(v: unknown): v is EscapeType {
  return typeof v === 'string' && v in ESCAPE_LABELS;
}

/** Linhas da coleção; o tipo de fuga sai com o rótulo (discreto, se ativo). */
export function collectionRows(data: AppData, key: CsvKey, discreet: boolean): Record<string, unknown>[] {
  return (data[key] as unknown as Record<string, unknown>[]).map((r) =>
    isEscape(r.type) ? { ...r, type: escapeLabel(r.type, discreet) } : r,
  );
}

export function exportCSV(data: AppData, key: CsvKey, discreet: boolean) {
  // BOM para o Excel reconhecer UTF-8
  download(`rumo-${key}-${dayKey()}.csv`, '﻿' + toCSV(collectionRows(data, key, discreet)), 'text/csv;charset=utf-8');
}

export type ParseResult = { ok: true; data: AppData; count: number; exportedAt?: string } | { ok: false; error: string };

const ARRAY_KEYS = (Object.keys(emptyData()) as CollectionKey[]).filter((k) => Array.isArray(emptyData()[k]));

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Valida um arquivo de backup (formato do Rumo ou o objeto de dados puro). */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'O arquivo não é um JSON válido.' };
  }
  if (!isObj(raw)) return { ok: false, error: 'O arquivo não tem o formato de um backup do Rumo.' };
  const exportedAt = typeof raw.exportedAt === 'string' ? raw.exportedAt : undefined;
  const body = raw.format === FORMAT ? raw.data : raw;
  if (!isObj(body)) return { ok: false, error: 'O arquivo não tem o formato de um backup do Rumo.' };

  const known = [...ARRAY_KEYS, 'profile', 'settings'];
  if (!Object.keys(body).some((k) => known.includes(k))) {
    return { ok: false, error: 'Não encontrei nenhuma coleção do Rumo neste arquivo.' };
  }

  const out = emptyData();
  let count = 0;
  for (const k of ARRAY_KEYS) {
    const v = body[k];
    if (v === undefined) continue;
    if (!Array.isArray(v) || !v.every(isObj)) return { ok: false, error: `A coleção “${k}” está corrompida.` };
    (out as unknown as Record<string, unknown>)[k] = v;
    count += v.length;
  }
  if (body.profile !== undefined && body.profile !== null) {
    const p = body.profile;
    if (!isObj(p) || typeof p.id !== 'string' || !Array.isArray(p.values) || !Array.isArray(p.escapes)) {
      return { ok: false, error: 'O perfil no arquivo está incompleto.' };
    }
    out.profile = { ...defaultProfile(), ...(p as Partial<NonNullable<AppData['profile']>>) };
  }
  if (body.settings !== undefined) {
    if (!isObj(body.settings)) return { ok: false, error: 'Os ajustes no arquivo estão corrompidos.' };
    out.settings = { ...out.settings, ...(body.settings as Partial<AppData['settings']>) };
  }
  return { ok: true, data: out, count, exportedAt };
}
