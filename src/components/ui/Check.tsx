import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Linha de checklist: toda a linha é o alvo de toque. */
export function Check({
  checked,
  onChange,
  children,
  hint,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'group flex min-h-12 w-full items-start gap-3.5 border-b border-rule py-3 text-left transition-colors last:border-b-0 hover:bg-paper-2',
        className,
      )}
    >
      <span
        className={cn(
          'mt-0.5 grid size-5 shrink-0 place-items-center rounded-[2px] border transition-colors duration-150',
          checked ? 'border-ink bg-ink' : 'border-ink-3 group-hover:border-ink',
        )}
        aria-hidden
      >
        <svg viewBox="0 0 16 16" className="size-3.5 text-paper" fill="none">
          <motion.path
            d="M3 8.5 6.5 12 13 4.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
            initial={false}
            animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
      </span>
      <span className="flex flex-col gap-0.5">
        <span className={cn('text-[0.9375rem] leading-snug', checked ? 'text-ink' : 'text-ink')}>{children}</span>
        {hint && <span className="text-sm text-ink-3">{hint}</span>}
      </span>
    </button>
  );
}

/** Chip de seleção múltipla (vulnerabilidades, valores, tipos). */
export function Chip({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-10 items-center rounded-full border px-3.5 text-sm font-[560] transition-colors duration-150',
        selected ? 'border-ink bg-ink text-paper' : 'border-rule-2 text-ink-2 hover:border-ink-3 hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  );
}
