import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const uid = () => crypto.randomUUID();

/** YYYY-MM-DD no fuso local. */
export function dayKey(d: Date | string = new Date()): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function sameDay(a: string | Date, b: string | Date = new Date()): boolean {
  return dayKey(a) === dayKey(b);
}

export function fmtTime(d: string | Date): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return x.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDate(d: string | Date, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return x.toLocaleDateString('pt-BR', opts).replace('.', '');
}

export function fmtLongDate(d: Date = new Date()): string {
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function minutesBetween(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
}

export function pad2(n: number) {
  return String(Math.floor(n)).padStart(2, '0');
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Período do dia para saudação/tema. */
export function isNightHour(h = new Date().getHours()) {
  return h >= 19 || h < 6;
}
