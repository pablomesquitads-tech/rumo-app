import { useId } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-[3px] border border-rule-2 bg-paper-2 p-0.5', className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative h-9 flex-1 rounded-[2px] px-3 text-sm font-[600] t-cond transition-colors',
              on ? 'text-paper' : 'text-ink-2 hover:text-ink',
            )}
          >
            {on && (
              <motion.span
                layoutId={`${id}-seg`}
                className="absolute inset-0 rounded-[2px] bg-ink"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative whitespace-nowrap">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
