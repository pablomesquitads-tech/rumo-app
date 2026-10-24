import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useApp, useData } from '@/store/app';
import { Page, Section } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { SlidingNumber } from '@/components/ui/sliding-number';
import { toast } from '@/components/ui/toast';
import { CompassRose, MarkReturn, MarkRock, MarkWave } from '@/components/marks/Marks';
import { CourseLine } from '@/components/today/CourseLine';
import { blocksOn, focusMinutesOn } from '@/lib/metrics';
import { cn, dayKey, fmtLongDate, isNightHour, sameDay } from '@/lib/utils';
import { useNow } from '@/hooks/useChartTheme';
import type { Task } from '@/lib/types';

const EASE = [0.16, 1, 0.3, 1] as const;

export default function Today() {
  const nav = useNavigate();
  const now = useNow();
  const today = dayKey(now);
  const upsert = useApp((s) => s.upsert);
  const profile = useData((d) => d.profile);
  const plan = useData((d) => d.dayPlans.find((p) => p.date === today));
  const allTasks = useData((d) => d.tasks);
  const sessions = useData((d) => d.focusSessions);
  const checkin = useData((d) => [...d.checkins].reverse().find((c) => c.kind === 'morning' && sameDay(c.at, now)));
  const eveningDone = useData((d) => d.reviews.some((r) => r.kind === 'evening' && sameDay(r.at, now)));
  const problem = useData((d) =>
    [...d.problems].filter((p) => p.status !== 'resolved').sort((a, b) => b.costScore * b.discomfort - a.costScore * a.discomfort)[0],
  );

  const tasks = useMemo(
    () => (plan?.priorities ?? []).map((id) => allTasks.find((t) => t.id === id)).filter(Boolean) as Task[],
    [plan, allTasks],
  );
  const firstOpen = tasks.find((t) => t.status !== 'done' && t.status !== 'dropped');
  const [picked, setPicked] = useState<string | undefined>();
  const current = tasks.find((t) => t.id === picked && t.status !== 'done') ?? firstOpen;

  const minutes = focusMinutesOn({ focusSessions: sessions }, today);
  const blocks = blocksOn({ focusSessions: sessions }, today);
  const planned = plan?.plannedBlocks ?? [];
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const nextBlock = planned.find((t, i) => i >= blocks.total && t >= hhmm) ?? planned[blocks.total];
  const workMin = profile?.focusDefaults.workMin ?? 25;

  const complete = (t: Task) => {
    upsert('tasks', { ...t, status: 'done', doneAt: new Date().toISOString() });
    setPicked(undefined);
    toast('Waypoint alcançado.');
  };

  const dateTitle = fmtLongDate(now);

  return (
    <Page className="lg:pt-8">
      {/* Cabeçalho: a data é o título da carta. */}
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2 border-b border-ink pb-4">
        <h1 className="t-display text-[clamp(2rem,5vw,3.5rem)] first-letter:uppercase">{dateTitle.split(',')[0]}</h1>
        <p className="t-label t-num pb-1.5">
          {dateTitle.split(',')[1]?.trim()} · {hhmm}
        </p>
      </header>

      {!plan || tasks.length === 0 ? (
        <NoCourse />
      ) : (
        <div className="grid gap-x-12 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="min-w-0">
            {/* Linha de rumo */}
            <section aria-label="Rumo do dia" className="relative pt-8 sm:pt-10">
              <CourseLine tasks={tasks} currentId={current?.id} blocksDone={blocks.completed} onSelect={setPicked} />
            </section>

            {/* Próximo passo */}
            {current ? (
              <motion.section
                key={current.id}
                initial={{ opacity: 0.001, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="mt-10 border-t border-rule pt-6"
                aria-label="Próximo passo"
              >
                <h2 className="t-display max-w-[22ch] text-[clamp(1.75rem,4.2vw,2.75rem)] leading-[1.06]">
                  {current.firstStep || current.title}
                </h2>
                <p className="mt-2 text-sm text-ink-3">
                  Primeiro passo de até 5 minutos{current.firstStep ? ` para “${current.title}”` : ''}.
                </p>
                {current.ifThen && <p className="t-plan mt-4 max-w-[46ch] text-[1.125rem] text-sea">{current.ifThen}</p>}
                <div className="mt-7 flex flex-wrap items-center gap-2.5">
                  <Button variant="primary" size="lg" onClick={() => nav(`/foco?task=${current.id}`)}>
                    Começar bloco · {workMin} min
                  </Button>
                  <Button variant="secondary" size="lg" onClick={() => complete(current)}>
                    Concluir
                  </Button>
                  <Button variant="quiet" size="lg" onClick={() => nav(`/foco?task=${current.id}&min=12`)}>
                    Só 12 min
                  </Button>
                </div>
              </motion.section>
            ) : (
              <section className="mt-10 border-t border-rule pt-6">
                <p className="t-display text-[clamp(1.75rem,4vw,2.5rem)]">Os três waypoints foram alcançados.</p>
                <p className="mt-3 max-w-[48ch] text-ink-2">
                  O resto do dia é seu. Se quiser, feche com a revisão noturna: três minutos para deixar o amanhã mais fácil.
                </p>
                <div className="mt-6 flex flex-wrap gap-2.5">
                  <Button variant="ink" size="lg" onClick={() => nav('/revisao')}>
                    Revisão noturna
                  </Button>
                  <Button variant="quiet" size="lg" onClick={() => nav('/foco')}>
                    Bloco livre
                  </Button>
                </div>
              </section>
            )}

            {/* Quartos (blocos planejados) */}
            {planned.length > 0 && (
              <Section label="Quartos de hoje" aside={`${blocks.completed} de ${planned.length} feitos`}>
                <ol className="flex flex-wrap gap-2">
                  {planned.map((t, i) => {
                    const done = i < blocks.completed;
                    const isNext = !done && t === nextBlock;
                    return (
                      <li
                        key={`${t}-${i}`}
                        className={cn(
                          't-num flex h-12 min-w-[5.25rem] items-center justify-center gap-2 rounded-[3px] border px-3 text-[1.0625rem] font-[600]',
                          done && 'border-ink bg-ink text-paper',
                          isNext && 'border-magenta text-magenta',
                          !done && !isNext && 'border-rule-2 text-ink-2',
                        )}
                      >
                        {t}
                        {done && <span className="sr-only">feito</span>}
                        {isNext && <span className="sr-only">próximo</span>}
                      </li>
                    );
                  })}
                </ol>
              </Section>
            )}

            {plan.woop && (
              <Section label="WOOP da tarefa mais difícil">
                <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  {(
                    [
                      ['Desejo', plan.woop.wish],
                      ['Melhor resultado', plan.woop.outcome],
                      ['Obstáculo', plan.woop.obstacle],
                      ['Plano', plan.woop.plan],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-1">
                      <dt className="t-label">{k}</dt>
                      <dd className={cn('text-ink', k === 'Plano' && 't-plan text-sea')}>{v || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </Section>
            )}
          </div>

          {/* Quarto atual */}
          <aside className="flex flex-col lg:border-l lg:border-rule lg:pl-8" aria-label="Quarto atual">
            <Section label="No mar hoje" className="lg:pt-10">
              <div className="flex items-end gap-6">
                <div className="flex flex-col gap-1">
                  <span className="t-label">Foco</span>
                  <span className="t-num t-display flex items-baseline gap-1.5 text-[2.75rem] leading-none">
                    <SlidingNumber value={minutes} />
                    <span className="text-base font-[500] tracking-normal text-ink-2">min</span>
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="t-label">Blocos</span>
                  <span className="t-num t-display text-[2.75rem] leading-none">
                    <SlidingNumber value={blocks.completed} />
                  </span>
                </div>
              </div>
              {nextBlock && (
                <p className="text-sm text-ink-2">
                  Próximo quarto às <span className="t-num font-[620] text-ink">{nextBlock}</span>.
                </p>
              )}
            </Section>

            <Section label="Check-in" aside={checkin ? undefined : <Link to="/checkin" className="text-magenta underline">fazer</Link>}>
              {checkin ? (
                <dl className="grid grid-cols-3 gap-3">
                  {(
                    [
                      ['Sono', checkin.sleepHours != null ? `${checkin.sleepHours}h` : '—'],
                      ['Humor', checkin.mood],
                      ['Energia', checkin.energy],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-0.5">
                      <dt className="t-label">{k}</dt>
                      <dd className="t-num t-title text-2xl">{v}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-ink-2">Sono, humor e energia ajudam o app a saber quando oferecer apoio.</p>
              )}
            </Section>

            {plan.antiEscapePlans.length > 0 && (
              <Section label="Plano anti-fuga">
                <ul className="flex flex-col gap-3">
                  {plan.antiEscapePlans.map((p, i) => (
                    <li key={i} className="t-plan text-[1.0625rem] leading-snug text-sea">
                      {p}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/sos"
                  className="inline-flex items-center gap-2 self-start text-sm font-[620] text-magenta underline-offset-4 hover:underline"
                >
                  <MarkWave size={18} /> Abrir SOS
                </Link>
              </Section>
            )}

            {problem && (
              <Section label="Hora do tapete">
                <Link to="/caixa" className="group flex items-start gap-3">
                  <MarkRock size={20} className="mt-0.5 shrink-0 text-ink-3 group-hover:text-ink" />
                  <span className="flex flex-col gap-1">
                    <span className="font-[560] text-ink group-hover:underline">{problem.title}</span>
                    <span className="text-sm text-ink-2">10 minutos no menor passo: {problem.smallestStep || 'definir'}</span>
                  </span>
                </Link>
              </Section>
            )}

            <Section label="Fechar o dia">
              {isNightHour(now.getHours()) && !eveningDone ? (
                <Button variant="ink" onClick={() => nav('/revisao')} className="self-start">
                  Revisão noturna · 3 min
                </Button>
              ) : (
                <p className="text-sm text-ink-2">
                  {eveningDone ? 'Revisão de hoje feita.' : 'A revisão noturna aparece aqui a partir das 19h.'}{' '}
                  <Link to="/checkin" className="text-ink underline">
                    Ajustar o plano
                  </Link>
                </p>
              )}
              {now.getDay() === 0 && (
                <Link to="/revisao?tipo=semanal" className="inline-flex items-center gap-2 text-sm font-[620] text-ink underline">
                  <MarkReturn size={18} /> Revisão semanal de domingo
                </Link>
              )}
            </Section>
          </aside>
        </div>
      )}
    </Page>
  );
}

function NoCourse() {
  const nav = useNavigate();
  return (
    <div className="relative grid gap-10 pt-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="max-w-[36rem]">
        <p className="t-display text-[clamp(2rem,5vw,3.25rem)] leading-[1.04]">Sem rumo traçado para hoje.</p>
        <p className="mt-4 text-[1.0625rem] leading-relaxed text-ink-2">
          Quatro minutos: como você dormiu, três prioridades com um primeiro passo de até cinco minutos, e um plano
          se-então para cada uma. Planos assim têm efeito médio a grande no alcance de metas.
        </p>
        <div className="mt-7 flex flex-wrap gap-2.5">
          <Button variant="primary" size="lg" onClick={() => nav('/checkin')}>
            Traçar o rumo de hoje
          </Button>
          <Button variant="quiet" size="lg" onClick={() => nav('/foco?min=12')}>
            Só um bloco de 12 min
          </Button>
        </div>
      </div>
      <CompassRose size={260} ticks className="hidden justify-self-end text-shoal-3 lg:block" />
    </div>
  );
}
