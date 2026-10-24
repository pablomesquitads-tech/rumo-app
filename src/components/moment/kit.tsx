import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/store/app';
import { cn, pad2 } from '@/lib/utils';

export const EASE = [0.16, 1, 0.3, 1] as const;

/** Movimento reduzido: preferência do sistema OU ajuste do app. */
export function useCalm(): boolean {
  const sys = useReducedMotion();
  const pref = useData((d) => d.settings.reducedMotion);
  return Boolean(sys) || pref;
}

/** Re-renderiza a cada `ms` enquanto `active`. O tempo real vem sempre de Date.now(). */
export function useTicker(active: boolean, ms = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), ms);
    const onVis = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [active, ms]);
  return now;
}

export function clock(ms: number): { m: number; s: number; label: string } {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return { m, s, label: `${pad2(m)}:${pad2(s)}` };
}

/* sessionStorage tolerante (modo privado, cota). */
export function readSession<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
export function writeSession(key: string, value: unknown) {
  try {
    if (value == null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sem armazenamento de sessão: o fluxo segue só em memória */
  }
}

/** Mantém a tela acesa durante o bloco, quando o navegador permite. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) void lock.release();
      } catch {
        /* negado (bateria fraca, aba oculta) */
      }
    };
    const onVis = () => {
      if (document.visibilityState === 'visible' && (!lock || lock.released)) void request();
    };
    void request();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}

/** Título da aba enquanto um timer corre; restaura ao sair. */
export function useDocumentTitle(title: string | null) {
  const original = useRef(document.title);
  useEffect(() => {
    const keep = original.current;
    return () => {
      document.title = keep;
    };
  }, []);
  useEffect(() => {
    document.title = title ?? original.current;
  }, [title]);
}

/* Som: dois tons senoidais suaves gerados na hora (sem arquivo). */
let audio: AudioContext | null = null;
export function unlockAudio() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audio ??= new Ctor();
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    audio = null;
  }
}
export function chime() {
  unlockAudio();
  if (!audio) return;
  const ctx = audio;
  const t0 = ctx.currentTime + 0.05;
  [
    { f: 523.25, at: 0 },
    { f: 783.99, at: 0.32 },
  ].forEach(({ f, at }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0, t0 + at);
    gain.gain.linearRampToValueAtTime(0.09, t0 + at + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 1.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + at);
    osc.stop(t0 + at + 1.7);
  });
}

export function buzz(pattern: number | number[] = 10) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* sem vibração */
  }
}

/** Sai de uma tela cheia: volta no histórico se veio de dentro do app. */
export function useLeave() {
  const nav = useNavigate();
  return (fallback = '/') => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) nav(-1);
    else nav(fallback, { replace: true });
  };
}

/* Tela cheia: moldura com barra de escala no topo e retícula muito sutil. */
export function MomentScreen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative isolate flex min-h-dvh flex-col bg-paper text-ink', className)}>
      <div aria-hidden className="graticule pointer-events-none absolute inset-0 -z-10 opacity-30" />
      <div className="safe-t bg-paper">
        <div className="neatline-x" aria-hidden />
      </div>
      {children}
    </div>
  );
}

export function CloseButton({ onClick, label = 'Fechar' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="-mr-2 grid size-11 shrink-0 place-items-center rounded-[3px] text-ink-2 transition-colors hover:bg-paper-3 hover:text-ink"
    >
      <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden>
        <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </button>
  );
}

/** Rodapé de ação fixo no polegar. `shell` desconta a barra inferior do app no celular. */
export function ActionFooter({ children, shell, className }: { children: ReactNode; shell?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        'sticky z-20 -mx-4 mt-8 border-t border-rule bg-paper/95 px-4 pt-3 backdrop-blur-[2px] sm:mx-0 sm:px-0',
        shell ? 'bottom-[calc(4rem+env(safe-area-inset-bottom))] pb-3 lg:bottom-0' : 'bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Células de escolha única (mesma gramática da Scale): radiogroup de botões grandes. */
export function Cells<T extends string | number>({
  label,
  options,
  value,
  onChange,
  cols = 2,
  className,
}: {
  label: string;
  options: { value: T; label: ReactNode; hint?: ReactNode }[];
  value: T | null | undefined;
  onChange: (v: T) => void;
  cols?: 2 | 3 | 4;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'grid overflow-hidden rounded-[3px] border border-rule-2 bg-rule gap-px',
        cols === 2 && 'grid-cols-2',
        cols === 3 && 'grid-cols-3',
        cols === 4 && 'grid-cols-2 sm:grid-cols-4',
        className,
      )}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex min-h-14 flex-col items-start justify-center gap-0.5 px-3.5 py-2.5 text-left transition-colors duration-150',
              on ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-paper-2',
            )}
          >
            <span className="text-[0.9375rem] font-[600] leading-tight">{o.label}</span>
            {o.hint && <span className={cn('t-num text-sm', on ? 'text-paper/75' : 'text-ink-3')}>{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
