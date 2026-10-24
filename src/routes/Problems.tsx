import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useApp, useData } from '@/store/app';
import type { AvoidedProblem } from '@/lib/types';
import { cn, dayKey, fmtDate, uid } from '@/lib/utils';
import { Page, ScreenHeader, Section, Empty } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { TextArea, TextField } from '@/components/ui/Field';
import { Scale } from '@/components/ui/Scale';
import { Segmented } from '@/components/ui/Segmented';
import { Check } from '@/components/ui/Check';
import { Sheet } from '@/components/ui/Dialog';
import { SlidingNumber } from '@/components/ui/sliding-number';
import { toast } from '@/components/ui/toast';
import { MarkRock } from '@/components/marks/Marks';

const EASE = [0.16, 1, 0.3, 1] as const;
const MAT_MIN = 10;
const MAT_KEY = 'rumo.tapete';

type Status = AvoidedProblem['status'];
const STATUS_LABEL: Record<Status, string> = { open: 'Aberto', in_progress: 'Em andamento', resolved: 'Resolvido' };

const score = (p: AvoidedProblem) => p.costScore * p.discomfort;

/* Passos de execução guardam o "feito" como prefixo, pois o tipo só tem string[]. */
const DONE = '[x] ';
const stepDone = (s: string) => s.startsWith(DONE);
const stepText = (s: string) => (stepDone(s) ? s.slice(DONE.length) : s);

function emptyPst(): NonNullable<AvoidedProblem['pst']> {
  return { definition: '', options: [], chosen: '', steps: [] };
}

/* Hora do tapete: só a data e o id ficam no aparelho, fora do cofre. */
function readMat(): { date: string; id: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(MAT_KEY) ?? 'null') as { date: string; id: string } | null;
    return v && typeof v.date === 'string' ? v : null;
  } catch {
    return null;
  }
}

function useIsDesktop() {
  const q = '(min-width: 1024px)';
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}

/** Linhas que mudaram de posição seguram o realce por ~2 s. */
function useMovedRows(ids: string[]) {
  const prev = useRef<string[]>(ids);
  const [moved, setMoved] = useState<Set<string>>(new Set());
  const order = ids.join('|');
  useEffect(() => {
    const ids = order ? order.split('|') : [];
    const before = prev.current;
    prev.current = ids;
    const changed = ids.filter((id, i) => before.includes(id) && before.indexOf(id) !== i);
    if (!changed.length) return;
    setMoved(new Set(changed));
    const t = setTimeout(() => setMoved(new Set()), 2000);
    return () => clearTimeout(t);
  }, [order]);
  return moved;
}

export default function Problems() {
  const problems = useData((d) => d.problems);
  const upsert = useApp((s) => s.upsert);
  const remove = useApp((s) => s.remove);
  const desktop = useIsDesktop();

  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [matTarget, setMatTarget] = useState<string | null>(null);
  const [mat, setMat] = useState(readMat);
  const [showResolved, setShowResolved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const captureRef = useRef<HTMLInputElement>(null);

  const open = useMemo(
    () => problems.filter((p) => p.status !== 'resolved').sort((a, b) => score(b) - score(a) || a.createdAt.localeCompare(b.createdAt)),
    [problems],
  );
  const resolved = useMemo(
    () => problems.filter((p) => p.status === 'resolved').sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? '')),
    [problems],
  );
  const moved = useMovedRows(open.map((p) => p.id));
  const current = problems.find((p) => p.id === selected) ?? null;

  const today = dayKey();
  const matDone = mat?.date === today || problems.some((p) => p.resolvedAt && dayKey(p.resolvedAt) === today);
  const matProblem = problems.find((p) => p.id === matTarget && p.status !== 'resolved') ?? open[0] ?? null;

  const patch = useCallback(
    (p: AvoidedProblem, change: Partial<AvoidedProblem>) => upsert('problems', { ...p, ...change }),
    [upsert],
  );

  const capture = (e: FormEvent) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    const p: AvoidedProblem = {
      id: uid(),
      title,
      discomfort: 5,
      costOfDelay: '',
      costScore: 5,
      smallestStep: '',
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    upsert('problems', p);
    setDraft('');
    setSelected(p.id);
    toast('Anotado. Detalhe quando puder.');
  };

  const finishMat = (p: AvoidedProblem, minutes: number, outcome: 'resolved' | 'progress' | 'none') => {
    const change: Partial<AvoidedProblem> = { minutesSpent: (p.minutesSpent ?? 0) + minutes };
    if (outcome === 'resolved') Object.assign(change, { status: 'resolved', resolvedAt: new Date().toISOString() });
    else if (outcome === 'progress' || p.status === 'open') change.status = 'in_progress';
    patch(p, change);
    const v = { date: today, id: p.id };
    try {
      localStorage.setItem(MAT_KEY, JSON.stringify(v));
    } catch {
      /* armazenamento indisponível: o registro de minutos já basta */
    }
    setMat(v);
    setMatTarget(null);
    toast(outcome === 'resolved' ? 'Resolvido. Fica no acumulado.' : 'Registrado. Dez minutos contam.');
  };

  const startMatOn = (id: string) => {
    setMatTarget(id);
    if (!desktop) setSelected(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const detail = current && (
    <ProblemDetail
      key={current.id}
      problem={current}
      onChange={(c) => patch(current, c)}
      onClose={() => setSelected(null)}
      onMat={() => startMatOn(current.id)}
      onDelete={() => setConfirmDelete(true)}
    />
  );

  return (
    <Page>
      <ScreenHeader
        title="Problemas evitados"
        meta={matDone ? 'Hora do tapete: feita hoje' : 'Hora do tapete: ainda hoje'}
        description="O que fica debaixo da superfície. Um problema por dia, dez minutos, começando pelo menor passo."
      />

      <form onSubmit={capture} className="flex gap-2 border-b border-rule py-5">
        <label htmlFor="captura" className="sr-only">
          O que estou evitando?
        </label>
        <input
          id="captura"
          ref={captureRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="O que estou evitando?"
          autoComplete="off"
          enterKeyHint="done"
          className="h-14 min-w-0 flex-1 rounded-[3px] border border-rule-2 bg-paper px-4 text-[1.0625rem] text-ink placeholder:text-ink-3 hover:border-ink-3 focus:border-ink focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--magenta)_22%,transparent)] focus:outline-none"
        />
        <Button type="submit" variant="ink" size="lg" disabled={!draft.trim()} className="px-5">
          Anotar
        </Button>
      </form>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_28rem]">
        <div className="min-w-0">
          {matProblem && (
            <MatHour
              key={matProblem.id}
              problem={matProblem}
              done={matDone}
              onStart={() => setMatTarget(matProblem.id)}
              onFinish={(m, o) => finishMat(matProblem, m, o)}
            />
          )}

          <Section label="Debaixo da superfície" aside={open.length ? 'custo de adiar × desconforto' : undefined}>
            {open.length === 0 ? (
              <Empty
                title={problems.length ? 'Nada aberto agora.' : 'Nada debaixo da superfície por enquanto.'}
                action={
                  <Button variant="secondary" size="sm" onClick={() => captureRef.current?.focus()}>
                    Anotar um problema
                  </Button>
                }
              >
                Um e-mail sem resposta, um boleto, uma conversa adiada. Só o título já basta; o resto vem depois.
              </Empty>
            ) : (
              <ul className="-mt-4 flex flex-col">
                {open.map((p) => (
                  <ProblemRow key={p.id} problem={p} active={p.id === selected} moved={moved.has(p.id)} onOpen={() => setSelected(p.id)} />
                ))}
              </ul>
            )}
          </Section>

          {resolved.length > 0 && (
            <section className="pt-8">
              <button
                type="button"
                aria-expanded={showResolved}
                onClick={() => setShowResolved((v) => !v)}
                className="flex min-h-11 w-full items-baseline justify-between gap-4 border-b border-rule pb-2 text-left"
              >
                <span className="t-label text-ink">Resolvidos</span>
                <span className="t-num text-sm text-ink-3">
                  {resolved.length} no acumulado · {showResolved ? 'recolher' : 'mostrar'}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {showResolved && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className="overflow-hidden"
                  >
                    {resolved.map((p) => (
                      <li key={p.id} className="border-b border-rule">
                        <button
                          type="button"
                          onClick={() => setSelected(p.id)}
                          className="flex min-h-12 w-full items-baseline justify-between gap-4 py-3 text-left hover:bg-paper-2"
                        >
                          <span className="text-ink-2 line-through decoration-rule-2">{p.title}</span>
                          <span className="t-num shrink-0 text-sm text-ink-3">
                            {p.resolvedAt ? fmtDate(p.resolvedAt) : ''}
                            {p.minutesSpent ? ` · ${p.minutesSpent} min` : ''}
                          </span>
                        </button>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </section>
          )}
        </div>

        {desktop ? (
          <aside className="hidden lg:block">
            <div className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto border-l border-rule pl-8 pt-8">
              {detail ?? (
                <p className="max-w-[22rem] pt-2 text-ink-3">
                  Escolha um problema da lista para detalhar: definir, gerar alternativas, decidir, executar e avaliar.
                </p>
              )}
            </div>
          </aside>
        ) : (
          <MobilePanel open={Boolean(current)} onClose={() => setSelected(null)} title={current?.title ?? ''}>
            {detail}
          </MobilePanel>
        )}
      </div>

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Apagar este problema?">
        <p className="mb-5 text-ink-2">Ele sai da lista e do acumulado. Isso não pode ser desfeito.</p>
        <div className="flex justify-end gap-2">
          <Button variant="quiet" onClick={() => setConfirmDelete(false)}>
            Manter
          </Button>
          <Button
            variant="ink"
            onClick={() => {
              if (current) remove('problems', current.id);
              setConfirmDelete(false);
              setSelected(null);
              toast('Apagado.');
            }}
          >
            Apagar
          </Button>
        </div>
      </Sheet>
    </Page>
  );
}

function ProblemRow({ problem: p, active, moved, onOpen }: { problem: AvoidedProblem; active: boolean; moved: boolean; onOpen: () => void }) {
  return (
    <motion.li layout transition={{ layout: { duration: 0.5, ease: EASE } }} className="border-b border-rule">
      <button
        type="button"
        onClick={onOpen}
        aria-current={active || undefined}
        className={cn(
          'grid w-full grid-cols-[2.75rem_minmax(0,1fr)] gap-x-3 py-4 pr-2 text-left transition-colors duration-700',
          moved ? 'bg-light-soft' : active ? 'bg-paper-2' : 'hover:bg-paper-2',
        )}
      >
        {/* sondagem: a profundidade do problema, como numa carta */}
        <span className="flex flex-col items-center gap-1 pt-0.5 text-ink-2" aria-label={`Peso ${score(p)} de 100`}>
          <MarkRock size={18} className={active ? 'text-magenta' : undefined} />
          <span className="t-num text-sm italic text-ink-2">{score(p)}</span>
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-[1.0625rem] font-[600] leading-snug text-ink">{p.title}</span>
          {p.smallestStep ? (
            <span className="t-plan text-ink-2">{p.smallestStep}</span>
          ) : (
            <span className="text-sm text-ink-3">Falta o menor passo possível.</span>
          )}
          <span className="t-label t-num flex flex-wrap gap-x-3 gap-y-0.5 pt-0.5 text-ink-3">
            <span>Desconforto {p.discomfort}</span>
            <span>Custo {p.costScore}</span>
            {p.scheduledFor && <span>Para {fmtDate(`${p.scheduledFor}T12:00:00`)}</span>}
            <span className={p.status === 'in_progress' ? 'text-sea' : undefined}>{STATUS_LABEL[p.status]}</span>
            {p.minutesSpent ? <span>{p.minutesSpent} min</span> : null}
          </span>
        </span>
      </button>
    </motion.li>
  );
}

/* ---------- Hora do tapete ---------- */

type MatPhase = 'idle' | 'running' | 'paused' | 'ask';

function MatHour({
  problem,
  done,
  onStart,
  onFinish,
}: {
  problem: AvoidedProblem;
  done: boolean;
  onStart: () => void;
  onFinish: (minutes: number, outcome: 'resolved' | 'progress' | 'none') => void;
}) {
  const [phase, setPhase] = useState<MatPhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);
  const baseRef = useRef(0);
  const total = MAT_MIN * 60_000;

  useEffect(() => {
    if (phase !== 'running') return;
    startRef.current = Date.now();
    const t = setInterval(() => {
      const e = baseRef.current + Date.now() - startRef.current;
      setElapsed(Math.min(e, total));
      if (e >= total) setPhase('ask');
    }, 250);
    return () => {
      clearInterval(t);
      baseRef.current += Date.now() - startRef.current;
    };
  }, [phase, total]);

  const left = Math.max(0, Math.ceil((total - elapsed) / 1000));
  const minutes = Math.max(1, Math.round(elapsed / 60_000));
  const step = problem.smallestStep || 'Abrir o assunto e escrever uma linha sobre ele.';

  if (phase === 'idle')
    return (
      <section className="flex flex-col gap-4 border-b border-rule py-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="t-label">{done ? 'Hora do tapete feita hoje' : 'Hora do tapete'}</span>
          <p className="t-title text-xl text-ink">{problem.title}</p>
          <p className="t-plan text-ink-2">{step}</p>
        </div>
        <Button variant={done ? 'secondary' : 'primary'} size="lg" onClick={() => {
            onStart();
            setPhase('running');
          }}
          className="shrink-0">
          {done ? 'Mais 10 minutos' : '10 minutos agora'}
        </Button>
      </section>
    );

  if (phase === 'ask')
    return (
      <motion.section
        initial={{ opacity: 0.4, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="flex flex-col gap-4 border-b border-rule py-6"
      >
        <p className="t-title text-2xl text-ink">Avançou?</p>
        <p className="text-ink-2">
          {minutes} min em <span className="text-ink">{problem.title}</span>. Qualquer resposta conta.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="go" onClick={() => onFinish(minutes, 'resolved')}>
            Resolvi
          </Button>
          <Button variant="ink" onClick={() => onFinish(minutes, 'progress')}>
            Avancei
          </Button>
          <Button variant="quiet" onClick={() => onFinish(minutes, 'none')}>
            Não desta vez
          </Button>
        </div>
      </motion.section>
    );

  return (
    <section className="flex flex-col gap-5 border-b border-rule py-6" aria-label="Hora do tapete em andamento">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div
          className="t-num t-display flex items-center text-[clamp(3.5rem,14vw,5.5rem)] leading-none text-ink"
          role="timer"
          aria-label={`${Math.floor(left / 60)} min e ${left % 60} s restantes`}
        >
          <SlidingNumber value={Math.floor(left / 60)} padStart />
          <span className="px-1 text-ink-3">:</span>
          <SlidingNumber value={left % 60} padStart />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setPhase(phase === 'running' ? 'paused' : 'running')}>
            {phase === 'running' ? 'Pausar' : 'Continuar'}
          </Button>
          <Button variant="quiet" onClick={() => setPhase('ask')}>
            Encerrar
          </Button>
        </div>
      </div>
      <div className="h-px w-full bg-rule">
        <div className="h-px bg-ink transition-[width] duration-300 ease-linear" style={{ width: `${(elapsed / total) * 100}%` }} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="t-label">Menor passo · {problem.title}</span>
        <p className="t-plan text-[clamp(1.25rem,3.5vw,1.625rem)] leading-snug text-ink">{step}</p>
      </div>
    </section>
  );
}

/* ---------- Detalhe ---------- */

function ProblemDetail({
  problem: p,
  onChange,
  onClose,
  onMat,
  onDelete,
}: {
  problem: AvoidedProblem;
  onChange: (c: Partial<AvoidedProblem>) => void;
  onClose: () => void;
  onMat: () => void;
  onDelete: () => void;
}) {
  const pst = p.pst ?? emptyPst();
  const setPst = (c: Partial<typeof pst>) => onChange({ pst: { ...pst, ...c } });
  const [option, setOption] = useState('');
  const [stepDraft, setStepDraft] = useState('');
  const optionRef = useRef<HTMLInputElement>(null);
  const resolvedNow = p.status === 'resolved';

  const setStatus = (s: Status) =>
    onChange({ status: s, resolvedAt: s === 'resolved' ? (p.resolvedAt ?? new Date().toISOString()) : undefined });

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex items-start justify-between gap-3">
        <TextField label="Problema" value={p.title} onChange={(e) => onChange({ title: e.target.value })} wrapClassName="flex-1" />
        <Button variant="quiet" size="sm" onClick={onClose} aria-label="Fechar detalhe" className="mt-6 hidden px-2 lg:inline-flex">
          <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden>
            <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </Button>
      </div>

      <Segmented
        label="Situação"
        value={p.status}
        onChange={setStatus}
        options={(['open', 'in_progress', 'resolved'] as Status[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
        className="w-full"
      />

      <Scale label="Desconforto" value={p.discomfort} onChange={(v) => onChange({ discomfort: v })} lowLabel="tranquilo" highLabel="evito pensar" />

      <div className="flex flex-col gap-3">
        <TextArea
          label="Custo de adiar"
          rows={2}
          value={p.costOfDelay}
          onChange={(e) => onChange({ costOfDelay: e.target.value })}
          placeholder="Multa, prazo perdido, a conversa fica mais difícil..."
        />
        <Scale label="Nota do custo" value={p.costScore} onChange={(v) => onChange({ costScore: v })} lowLabel="quase nada" highLabel="cresce todo dia" />
      </div>

      <TextField
        label="Menor passo possível"
        plan
        value={p.smallestStep}
        onChange={(e) => onChange({ smallestStep: e.target.value })}
        placeholder="abrir o e-mail e escrever só a saudação"
        hint="Algo de 2 a 5 minutos. É nele que os 10 minutos começam."
      />

      <TextField
        label="Agendado para"
        type="date"
        value={p.scheduledFor ?? ''}
        onChange={(e) => onChange({ scheduledFor: e.target.value || undefined })}
        className="t-num"
      />

      {!resolvedNow && (
        <Button variant="secondary" onClick={onMat}>
          10 minutos neste problema
        </Button>
      )}

      <div className="flex flex-col">
        <div className="flex items-baseline justify-between gap-3 border-b border-ink pb-2">
          <h3 className="t-label text-ink">Resolução de problemas</h3>
          <span className="text-sm text-ink-3">D'Zurilla e Nezu</span>
        </div>
        <ol className="flex flex-col">
          <PstStep label="Definir">
            <TextArea
              label="Qual é exatamente o problema?"
              rows={2}
              value={pst.definition}
              onChange={(e) => setPst({ definition: e.target.value })}
              placeholder="Preciso pedir revisão da nota de Física até sexta."
            />
          </PstStep>

          <PstStep label="Gerar alternativas" hint="Escreva tudo o que vier, até as ruins. Julgar fica para o próximo passo.">
            {pst.options.length > 0 && (
              <ul className="flex flex-col">
                {pst.options.map((o, i) => (
                  <li key={i} className="flex min-h-11 items-center justify-between gap-2 border-b border-rule last:border-b-0">
                    <span className="text-ink">{o}</span>
                    <Button
                      variant="quiet"
                      size="sm"
                      aria-label={`Remover alternativa ${o}`}
                      onClick={() => setPst({ options: pst.options.filter((_, j) => j !== i), chosen: pst.chosen === o ? '' : pst.chosen })}
                      className="px-2"
                    >
                      <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
                        <path d="m6 6 8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <InlineAdd
              inputRef={optionRef}
              label="Nova alternativa"
              placeholder="mandar e-mail ao professor"
              value={option}
              onChange={setOption}
              onAdd={() => {
                setPst({ options: [...pst.options, option.trim()] });
                setOption('');
              }}
            />
          </PstStep>

          <PstStep label="Decidir" hint={pst.options.length ? 'Escolha uma. Boa o bastante já serve.' : 'Aparece quando houver alternativas.'}>
            {pst.options.length > 0 && (
              <div role="radiogroup" aria-label="Alternativa escolhida" className="flex flex-col">
                {pst.options.map((o, i) => {
                  const on = pst.chosen === o;
                  return (
                    <button
                      key={i}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setPst({ chosen: on ? '' : o })}
                      className="flex min-h-11 items-center gap-3 border-b border-rule py-2 text-left last:border-b-0 hover:bg-paper-2"
                    >
                      <span
                        className={cn('grid size-5 shrink-0 place-items-center rounded-full border', on ? 'border-magenta' : 'border-ink-3')}
                        aria-hidden
                      >
                        {on && <span className="size-2.5 rounded-full bg-magenta" />}
                      </span>
                      <span className={on ? 'font-[600] text-ink' : 'text-ink-2'}>{o}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </PstStep>

          <PstStep label="Passos de execução">
            {pst.steps.length > 0 && (
              <div className="flex flex-col">
                {pst.steps.map((s, i) => (
                  <Check
                    key={i}
                    checked={stepDone(s)}
                    onChange={(v) => setPst({ steps: pst.steps.map((x, j) => (j === i ? (v ? DONE : '') + stepText(x) : x)) })}
                  >
                    <span className={stepDone(s) ? 'text-ink-3 line-through decoration-rule-2' : undefined}>{stepText(s)}</span>
                  </Check>
                ))}
              </div>
            )}
            <InlineAdd
              label="Novo passo"
              placeholder="achar o e-mail do professor"
              value={stepDraft}
              onChange={setStepDraft}
              onAdd={() => {
                setPst({ steps: [...pst.steps, stepDraft.trim()] });
                setStepDraft('');
              }}
            />
          </PstStep>

          <PstStep label="Avaliar" last>
            {pst.chosen || pst.steps.length ? (
              <div className="flex flex-col gap-3">
                <p className="text-ink-2">{resolvedNow ? 'Marcado como resolvido.' : 'Depois de agir: o problema se resolveu?'}</p>
                {!resolvedNow && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="go" onClick={() => setStatus('resolved')}>
                      Resolvido
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        onChange({ status: 'in_progress', pst: { ...pst, chosen: '' } });
                        optionRef.current?.focus();
                      }}
                    >
                      Ainda não: outra alternativa
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink-3">Depois de decidir e agir, volte aqui.</p>
            )}
          </PstStep>
        </ol>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-rule pt-4">
        <span className="t-label t-num text-ink-3">
          Anotado em {fmtDate(p.createdAt)}
          {p.minutesSpent ? ` · ${p.minutesSpent} min dedicados` : ''}
        </span>
        <Button variant="quiet" size="sm" onClick={onDelete}>
          Apagar
        </Button>
      </div>
    </div>
  );
}

function PstStep({ label, hint, children, last }: { label: string; hint?: string; children: ReactNode; last?: boolean }) {
  return (
    <li className="relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 pt-4">
      <span className="relative flex justify-center" aria-hidden>
        <span className="mt-[3px] size-2.5 rounded-full border border-ink bg-paper" />
        {!last && <span className="absolute bottom-0 top-4 w-px border-l border-dashed border-rule-2" />}
      </span>
      <div className="flex min-w-0 flex-col gap-2 pb-4">
        <span className="t-label text-ink">{label}</span>
        {hint && <p className="text-sm text-ink-3">{hint}</p>}
        {children}
      </div>
    </li>
  );
}

function InlineAdd({
  label,
  placeholder,
  value,
  onChange,
  onAdd,
  inputRef,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  inputRef?: RefObject<HTMLInputElement>;
}) {
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onAdd();
      }}
    >
      <input
        ref={inputRef}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 min-w-0 flex-1 rounded-[3px] border border-rule-2 bg-paper px-3 text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none"
      />
      <Button type="submit" variant="secondary" disabled={!value.trim()}>
        Adicionar
      </Button>
    </form>
  );
}

/** Tela própria no celular: cobre a barra inferior, volta com o botão do topo ou Esc. */
function MobilePanel({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          initial={{ x: '6%', opacity: 0.4 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '6%', opacity: 0 }}
          transition={{ duration: 0.36, ease: EASE }}
          className="safe-t fixed inset-0 z-[55] flex flex-col bg-paper lg:hidden"
        >
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-rule px-2">
            <Button variant="quiet" size="md" onClick={onClose} className="px-3">
              <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden>
                <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              Problemas
            </Button>
          </div>
          <div className="safe-b flex-1 overflow-y-auto px-4 pt-5">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
