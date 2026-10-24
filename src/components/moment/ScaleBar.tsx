import { cn, clamp } from '@/lib/utils';

/**
 * Progresso desenhado como a barra de escala da carta: segmentos alternados
 * dentro de um filete de tinta, que se preenchem da esquerda para a direita.
 * A agulha magenta marca o instante atual.
 */
export function ScaleBar({
  progress,
  minutes,
  label,
  className,
  needle = true,
}: {
  progress: number;
  minutes: number;
  label: string;
  className?: string;
  needle?: boolean;
}) {
  const p = clamp(progress, 0, 1);
  const segments = minutes <= 30 ? Math.max(4, Math.round(minutes)) : Math.ceil(minutes / 2);
  const mid = Math.round(minutes / 2);

  return (
    <div className={cn('flex w-full flex-col gap-1.5', className)}>
      <div
        className="relative h-2.5 w-full"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(p * 100)}
      >
        <div className="flex h-full w-full border border-ink">
          {Array.from({ length: segments }, (_, i) => {
            const fill = clamp(p * segments - i, 0, 1);
            const even = i % 2 === 0;
            return (
              <span key={i} className={cn('relative flex-1 overflow-hidden', even ? 'bg-rule' : 'bg-paper')}>
                <span
                  className={cn(
                    'absolute inset-0 origin-left transition-transform duration-300 ease-linear',
                    even ? 'bg-ink' : 'bg-shoal-3',
                  )}
                  style={{ transform: `scaleX(${fill})` }}
                />
              </span>
            );
          })}
        </div>
        {needle && (
          <span
            aria-hidden
            className="absolute -bottom-1.5 -top-1.5 w-0.5 -translate-x-1/2 bg-magenta transition-[left] duration-300 ease-linear"
            style={{ left: `${p * 100}%` }}
          />
        )}
      </div>
      <div className="t-label t-num flex justify-between text-ink-3" aria-hidden>
        <span>0</span>
        <span>{mid}</span>
        <span>{minutes} min</span>
      </div>
    </div>
  );
}
