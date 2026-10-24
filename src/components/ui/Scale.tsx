import { useId, useRef, type KeyboardEvent } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

export interface ScaleProps {
  label: string;
  value: number | null | undefined;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  lowLabel?: string;
  highLabel?: string;
  className?: string;
  /** Destaque visual: 'ink' (padrão) ou 'magenta' para intensidade de impulso. */
  tone?: 'ink' | 'magenta';
}

/** Escala 0–10 em células fixas (estilo placa de partida). Radiogroup acessível. */
export function Scale({ label, value, onChange, min = 0, max = 10, lowLabel, highLabel, className, tone = 'ink' }: ScaleProps) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  const onKey = (e: KeyboardEvent, v: number) => {
    let n = v;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') n = Math.min(max, v + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') n = Math.max(min, v - 1);
    else if (e.key === 'Home') n = min;
    else if (e.key === 'End') n = max;
    else return;
    e.preventDefault();
    onChange(n);
    refs.current[n - min]?.focus();
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span id={id} className="t-label">
          {label}
        </span>
        <span className="t-num t-title text-xl text-ink" aria-hidden>
          {value ?? '–'}
        </span>
      </div>
      <div role="radiogroup" aria-labelledby={id} className="grid grid-cols-11 overflow-hidden rounded-[3px] border border-rule-2">
        {values.map((v) => {
          const on = value === v;
          return (
            <button
              key={v}
              ref={(el) => {
                refs.current[v - min] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={String(v)}
              tabIndex={on || (value == null && v === min) ? 0 : -1}
              onClick={() => onChange(v)}
              onKeyDown={(e) => onKey(e, v)}
              className={cn(
                't-num relative h-11 border-l border-rule text-[0.9375rem] font-[560] transition-colors first:border-l-0 sm:h-12',
                on ? (tone === 'magenta' ? 'text-magenta-ink' : 'text-paper') : 'text-ink-2 hover:bg-paper-3 hover:text-ink',
              )}
            >
              {on && (
                <motion.span
                  layoutId={`${id}-cell`}
                  className={cn('absolute inset-0', tone === 'magenta' ? 'bg-magenta' : 'bg-ink')}
                  transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                />
              )}
              <span className="relative">{v}</span>
            </button>
          );
        })}
      </div>
      {(lowLabel || highLabel) && (
        <div className="flex justify-between text-sm text-ink-3">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </div>
  );
}
