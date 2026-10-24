import { motion } from 'motion/react';
import type { Task } from '@/lib/types';
import { cn } from '@/lib/utils';

const AREA: Record<Task['area'], string> = { academic: 'Acadêmica', life: 'Vida', health: 'Saúde' };
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * A linha de rumo do dia: partida → waypoints (prioridades).
 * Trecho percorrido em traço cheio; o que falta, tracejado; a embarcação no waypoint atual.
 */
export function CourseLine({
  tasks,
  currentId,
  blocksDone,
  onSelect,
}: {
  tasks: Task[];
  currentId?: string;
  blocksDone: number;
  onSelect: (id: string) => void;
}) {
  const n = tasks.length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const cur = Math.max(0, tasks.findIndex((t) => t.id === currentId));
  // Posição da embarcação: no último concluído, ou entre a partida e o atual.
  const vesselIdx = doneCount === n ? n : cur;

  return (
    <>
      {/* Horizontal (≥ sm) */}
      <div className="relative hidden sm:block">
        <div
          className="relative grid"
          style={{ gridTemplateColumns: `minmax(5.5rem,0.6fr) repeat(${n}, minmax(0,1fr))` }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-[0.75rem]" aria-hidden>
            <Leg from={0} to={1} n={n} done={blocksDone > 0 || doneCount > 0} delay={0} />
            {tasks.slice(0, -1).map((t, i) => (
              <Leg key={t.id} from={i + 1} to={i + 2} n={n} done={t.status === 'done'} delay={0.12 * (i + 1)} />
            ))}
          </div>

          <div className="flex flex-col items-start gap-3 pr-4">
            <Node kind="start" />
            <div className="flex flex-col gap-0.5">
              <span className="t-label">Partida</span>
              <span className="text-sm text-ink-2">{blocksDone ? `${blocksDone} bloco${blocksDone > 1 ? 's' : ''}` : 'ainda no cais'}</span>
            </div>
          </div>

          {tasks.map((t, i) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className={cn(
                'group flex flex-col items-start gap-3 pr-5 text-left',
                t.id === currentId ? 'text-ink' : 'text-ink-2 hover:text-ink',
              )}
            >
              <Node kind={t.status === 'done' ? 'done' : t.id === currentId ? 'current' : 'todo'} vessel={vesselIdx === i + 1 || (vesselIdx === i && t.id === currentId)} />
              <span className="flex flex-col gap-1">
                <span className="t-label">
                  {AREA[t.area]}
                  {t.status === 'done' && <span className="text-go"> · feito</span>}
                </span>
                <span className={cn('line-clamp-2 text-[1.0625rem] leading-snug', t.id === currentId ? 'font-[620]' : 'font-[480]', t.status === 'done' && 'text-ink-3 line-through decoration-1')}>
                  {t.title}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Vertical (celular) */}
      <ol className="relative sm:hidden">
        {tasks.map((t, i) => {
          const isCur = t.id === currentId;
          const done = t.status === 'done';
          return (
            <li key={t.id} className="relative flex gap-4 pb-5 last:pb-0">
              {i < n - 1 && (
                <span
                  aria-hidden
                  className={cn('absolute left-[0.6875rem] top-7 bottom-0 w-0 border-l-[1.5px]', done ? 'border-ink' : 'border-dashed border-ink-3')}
                />
              )}
              <Node kind={done ? 'done' : isCur ? 'current' : 'todo'} vessel={isCur} />
              <button type="button" onClick={() => onSelect(t.id)} className="-mt-0.5 flex flex-1 flex-col gap-0.5 text-left">
                <span className="t-label">
                  {AREA[t.area]}
                  {done && <span className="text-go"> · feito</span>}
                </span>
                <span className={cn('text-[1.0625rem] leading-snug', isCur ? 'font-[620] text-ink' : 'text-ink-2', done && 'text-ink-3 line-through decoration-1')}>
                  {t.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function Leg({ from, to, n, done, delay }: { from: number; to: number; n: number; done: boolean; delay: number }) {
  // Colunas: partida tem 0.6fr; aproximação suficiente para o traço (os nós ficam à esquerda de cada coluna).
  const total = 0.6 + n;
  const x = (i: number) => (i === 0 ? 0 : (0.6 + (i - 1)) / total) * 100;
  return (
    <motion.span
      className={cn('absolute top-0 block origin-left border-t', done ? 'border-t-[1.75px] border-ink' : 'border-dashed border-t-[1.5px] border-ink-3')}
      style={{ left: `calc(${x(from)}% + 1.75rem)`, width: `calc(${x(to) - x(from)}% - 2rem)` }}
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    />
  );
}

function Node({ kind, vessel }: { kind: 'start' | 'todo' | 'current' | 'done'; vessel?: boolean }) {
  return (
    <span className="relative grid size-6 shrink-0 place-items-center" aria-hidden>
      {kind === 'start' && <span className="size-3 rotate-45 border-[1.5px] border-ink bg-paper" />}
      {kind === 'todo' && <span className="size-[1.125rem] rounded-full border-[1.5px] border-ink-3 bg-paper" />}
      {kind === 'done' && (
        <span className="grid size-[1.125rem] place-items-center rounded-full bg-ink">
          <svg viewBox="0 0 12 12" className="size-2.5 text-paper" fill="none">
            <path d="M2.5 6.2 5 8.5l4.5-5" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </span>
      )}
      {kind === 'current' && (
        <>
          <motion.span
            className="absolute size-6 rounded-full border border-magenta"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [1, 1.35, 1], opacity: [0.9, 0, 0.9] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className="grid size-[1.125rem] place-items-center rounded-full border-[1.5px] border-magenta bg-paper">
            <span className="size-1.5 rounded-full bg-magenta" />
          </span>
        </>
      )}
      {vessel && (
        <motion.svg
          layoutId="vessel"
          viewBox="0 0 16 16"
          className="absolute -top-5 left-1/2 size-4 -translate-x-1/2 text-magenta"
          transition={{ type: 'spring', stiffness: 180, damping: 22 }}
        >
          <path d="M8 1.5 12 13 8 10.6 4 13Z" fill="currentColor" transform="rotate(90 8 8)" />
        </motion.svg>
      )}
    </span>
  );
}
