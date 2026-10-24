import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useApp, useData } from '@/store/app';
import { Page, Section } from '@/components/ui/Screen';
import { Flow, FlowQuestion } from '@/components/ui/Flow';
import { Button } from '@/components/ui/Button';
import { IfThenField, TextField, splitIfThen } from '@/components/ui/Field';
import { Scale } from '@/components/ui/Scale';
import { Segmented } from '@/components/ui/Segmented';
import { Chip } from '@/components/ui/Check';
import { SlidingNumber } from '@/components/ui/sliding-number';
import { toast } from '@/components/ui/toast';
import { MarkLight, MarkWaypoint } from '@/components/marks/Marks';
import { escapeLabel } from '@/lib/defaults';
import type { CheckIn as CheckInT, DayPlan, EscapeType, Task, TaskArea, Woop } from '@/lib/types';
import { cn, dayKey, pad2, sameDay, uid } from '@/lib/utils';

type Loc = NonNullable<CheckInT['location']>;

interface Draft {
  id: string;
  title: string;
  area: TaskArea;
  firstStep: string;
  aversiveness: number | null;
  ifThen: string;
  existing?: Task;
}

const AREAS: { value: TaskArea; label: string }[] = [
  { value: 'academic', label: 'Acadêmica' },
  { value: 'life', label: 'Vida' },
  { value: 'health', label: 'Saúde' },
];
const AREA_LABEL: Record<TaskArea, string> = { academic: 'Acadêmica', life: 'Vida', health: 'Saúde' };

const LOCATIONS: { value: Loc; label: string }[] = [
  { value: 'home', label: 'Casa' },
  { value: 'campus', label: 'Campus' },
  { value: 'library', label: 'Biblioteca' },
  { value: 'other', label: 'Outro lugar' },
];

const EMPTY_WOOP: Woop = { wish: '', outcome: '', obstacle: '', plan: '' };
const ease = [0.16, 1, 0.3, 1] as const;

const blank = (area: TaskArea = 'academic'): Draft => ({ id: uid(), title: '', area, firstStep: '', aversiveness: null, ifThen: '' });

const fromTask = (t: Task): Draft => ({
  id: t.id,
  title: t.title,
  area: t.area,
  firstStep: t.firstStep,
  aversiveness: t.aversiveness,
  ifThen: t.ifThen ?? '',
  existing: t,
});

function toMin(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
const fromMin = (m: number) => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
const sortTimes = (xs: string[]) => [...new Set(xs)].sort((a, b) => toMin(a) - toMin(b));

function antiEscapeFor(t: EscapeType, discreet: boolean) {
  const name = escapeLabel(t, discreet);
  return discreet ? `Se eu sentir o ${name}, então aperto o SOS` : `Se eu sentir vontade de ${name.toLowerCase()}, então aperto o SOS`;
}

export default function CheckIn() {
  const nav = useNavigate();
  const upsert = useApp((s) => s.upsert);
  const today = dayKey();

  const profile = useData((d) => d.profile);
  const discreet = useData((d) => d.settings.discreet);
  const tasks = useData((d) => d.tasks);
  const plan = useData((d) => d.dayPlans.find((p) => p.date === today));
  const morning = useData((d) => [...d.checkins].reverse().find((c) => c.kind === 'morning' && sameDay(c.at)));
  const lastSleep = useData((d) => [...d.checkins].reverse().find((c) => c.sleepHours != null)?.sleepHours);
  const escapeCounts = useData((d) => {
    const c = new Map<EscapeType, number>();
    [...d.lapses, ...d.urges].forEach((x) => c.set(x.type, (c.get(x.type) ?? 0) + 1));
    return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).join(',');
  });

  const escapeTypes = useMemo(() => {
    const fromHistory = escapeCounts ? (escapeCounts.split(',') as EscapeType[]) : [];
    const fromProfile = profile?.escapes.map((e) => e.type) ?? [];
    return [...new Set([...fromHistory, ...fromProfile])];
  }, [escapeCounts, profile]);

  const editing = Boolean(plan);

  // estado inicial: dados atuais do plano (modo edição) ou valores sugeridos
  const [checkinId] = useState(() => morning?.id ?? uid());
  const [sleep, setSleep] = useState<number>(() => morning?.sleepHours ?? lastSleep ?? 7);
  const [mood, setMood] = useState<number | null>(morning?.mood ?? null);
  const [energy, setEnergy] = useState<number | null>(morning?.energy ?? null);
  const [loc, setLoc] = useState<Loc | undefined>(morning?.location);
  const [drafts, setDrafts] = useState<Draft[]>(() => {
    const existing = (plan?.priorities ?? []).map((id) => tasks.find((t) => t.id === id)).filter((t): t is Task => Boolean(t));
    return existing.length ? existing.map(fromTask) : [blank()];
  });
  const [blocks, setBlocks] = useState<string[]>(() => plan?.plannedBlocks ?? []);
  const [antiEscape, setAntiEscape] = useState<string[]>(() =>
    plan?.antiEscapePlans.length ? plan.antiEscapePlans : [antiEscapeFor(escapeTypes[0] ?? 'social', discreet)],
  );
  const [woop, setWoop] = useState<Woop>(() => plan?.woop ?? EMPTY_WOOP);
  const [step, setStep] = useState(editing ? 1 : 0);
  const [tried, setTried] = useState(false);

  const chosen = drafts.filter((d) => d.title.trim());
  const academic = chosen.find((d) => d.area === 'academic');
  const mostAversive = [...chosen].sort((a, b) => (b.aversiveness ?? 0) - (a.aversiveness ?? 0))[0];

  // passos: check-in, prioridades, um por prioridade, se-então, blocos, anti-fuga, WOOP, resumo
  const stepKeys = ['checkin', 'priorities', ...chosen.map((d) => `step:${d.id}`), 'ifthen', 'blocks', 'anti', 'woop', 'summary'];
  const total = stepKeys.length;
  const key = stepKeys[Math.min(step, total - 1)];
  const go = (n: number) => {
    setTried(false);
    setStep(Math.max(0, Math.min(total - 1, n)));
    window.scrollTo({ top: 0 });
  };
  const next = () => go(step + 1);
  const back = () => go(step - 1);

  const patchDraft = (id: string, patch: Partial<Draft>) => setDrafts((xs) => xs.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const saveCheckIn = () => {
    if (mood == null || energy == null) return;
    upsert('checkins', {
      id: checkinId,
      at: morning?.at ?? new Date().toISOString(),
      kind: 'morning',
      mood,
      energy,
      sleepHours: sleep,
      location: loc,
    });
  };

  const saveAll = () => {
    const now = new Date().toISOString();
    chosen.forEach((d) => {
      const base = d.existing;
      upsert('tasks', {
        id: d.id,
        title: d.title.trim(),
        area: d.area,
        firstStep: d.firstStep.trim(),
        ifThen: d.ifThen.trim() || undefined,
        aversiveness: d.aversiveness ?? 5,
        status: base?.status === 'doing' ? 'doing' : 'todo',
        createdAt: base?.createdAt ?? now,
        due: base?.due,
      });
    });
    const hasWoop = Object.values(woop).some((v) => v.trim());
    const dp: DayPlan = {
      date: today,
      priorities: chosen.map((d) => d.id),
      antiEscapePlans: antiEscape.map((p) => p.trim()).filter(Boolean),
      woop: hasWoop ? woop : undefined,
      plannedBlocks: sortTimes(blocks),
    };
    upsert('dayPlans', dp);
  };

  const finish = (startFocus: boolean) => {
    saveAll();
    toast(editing ? 'Plano atualizado.' : 'Plano do dia registrado.');
    if (startFocus && academic) nav(`/foco?task=${academic.id}`);
    else nav('/');
  };

  let body: ReactNode = null;
  let footer: ReactNode = null;

  if (key === 'checkin') {
    body = (
      <StepCheckIn sleep={sleep} setSleep={setSleep} mood={mood} setMood={setMood} energy={energy} setEnergy={setEnergy} loc={loc} setLoc={setLoc} />
    );
    footer = (
      <Button
        variant="ink"
        size="lg"
        block
        disabled={mood == null || energy == null}
        onClick={() => {
          saveCheckIn();
          next();
        }}
      >
        {mood == null || energy == null ? 'Marque humor e energia' : 'Continuar'}
      </Button>
    );
  } else if (key === 'priorities') {
    const valid = chosen.length > 0 && Boolean(academic);
    body = <StepPriorities drafts={drafts} setDrafts={setDrafts} patch={patchDraft} tasks={tasks} tried={tried} />;
    footer = (
      <Button
        variant="ink"
        size="lg"
        block
        aria-disabled={!valid}
        className={cn(!valid && 'opacity-60')}
        onClick={() => {
          if (!valid) return setTried(true);
          setDrafts((xs) => xs.filter((d) => d.title.trim()));
          next();
        }}
      >
        Continuar com {chosen.length || 'nenhuma'} {chosen.length === 1 ? 'prioridade' : 'prioridades'}
      </Button>
    );
  } else if (key.startsWith('step:')) {
    const d = chosen.find((x) => `step:${x.id}` === key)!;
    const idx = chosen.indexOf(d);
    const ok = d.firstStep.trim().length > 0 && d.aversiveness != null;
    body = (
      <div className="flex flex-col gap-8">
        <FlowQuestion sub="Algo que dá para fazer com o corpo em até 5 minutos. Quanto mais concreto, mais fácil começar.">
          Qual é o primeiro passo físico?
        </FlowQuestion>
        <p className="t-title -mt-4 border-y border-rule py-3 text-lg text-ink">
          <span className="t-label t-num mr-3">
            {idx + 1}/{chosen.length}
          </span>
          {d.title}
        </p>
        <TextField
          label="Primeiro passo, até 5 min"
          placeholder="abrir o PDF da lista 3 na página 1"
          value={d.firstStep}
          onChange={(e) => patchDraft(d.id, { firstStep: e.target.value })}
          autoFocus
        />
        <Scale
          label="Quanto esta tarefa incomoda?"
          value={d.aversiveness}
          onChange={(v) => patchDraft(d.id, { aversiveness: v })}
          lowLabel="nada"
          highLabel="muito"
        />
      </div>
    );
    footer = (
      <Button
        variant="ink"
        size="lg"
        block
        disabled={!ok}
        onClick={() => {
          if (!d.ifThen.trim()) patchDraft(d.id, { ifThen: `Se , então ${d.firstStep.trim()}` });
          next();
        }}
      >
        {ok ? 'Continuar' : 'Escreva o passo e marque o incômodo'}
      </Button>
    );
  } else if (key === 'ifthen') {
    body = (
      <div className="flex flex-col gap-8">
        <FlowQuestion sub="Quando e onde você vai dar o primeiro passo. Planos se-então têm efeito médio a grande sobre metas (d = 0,65; 94 testes).">
          Um plano se-então para cada prioridade
        </FlowQuestion>
        <ul className="flex flex-col">
          {chosen.map((d) => {
            return (
              <li key={d.id} className="flex flex-col gap-3 border-t border-rule py-5 first:border-t-0 first:pt-0">
                <p className="t-title text-base text-ink">{d.title}</p>
                <IfThenField
                  label="Plano"
                  value={d.ifThen}
                  onChange={(v) => patchDraft(d.id, { ifThen: v })}
                  thenPlaceholder={d.firstStep || 'abro o PDF da lista 3'}
                />
              </li>
            );
          })}
        </ul>
      </div>
    );
    const ok = chosen.every((d) => {
      const [a, b] = splitIfThen(d.ifThen);
      return a.trim() && b.trim();
    });
    footer = (
      <Button
        variant="ink"
        size="lg"
        block
        disabled={!ok}
        onClick={next}
      >
        {ok ? 'Continuar' : 'Complete o "se" de cada plano'}
      </Button>
    );
  } else if (key === 'blocks') {
    body = <StepBlocks blocks={blocks} setBlocks={setBlocks} />;
    footer = (
      <Button variant="ink" size="lg" block disabled={blocks.length === 0} onClick={next}>
        {blocks.length === 0 ? 'Adicione ao menos um horário' : `Continuar com ${blocks.length} ${blocks.length === 1 ? 'bloco' : 'blocos'}`}
      </Button>
    );
  } else if (key === 'anti') {
    body = <StepAntiEscape plans={antiEscape} setPlans={setAntiEscape} escapeTypes={escapeTypes} discreet={discreet} />;
    footer = (
      <Button variant="ink" size="lg" block disabled={!antiEscape.some((p) => p.trim())} onClick={next}>
        Continuar
      </Button>
    );
  } else if (key === 'woop') {
    body = <StepWoop woop={woop} setWoop={setWoop} task={mostAversive} />;
    footer = (
      <div className="flex gap-2">
        <Button
          variant="quiet"
          size="lg"
          onClick={() => {
            setWoop(EMPTY_WOOP);
            next();
          }}
        >
          Pular
        </Button>
        <Button variant="ink" size="lg" className="flex-1" onClick={next}>
          Continuar
        </Button>
      </div>
    );
  } else {
    body = <StepSummary drafts={chosen} blocks={sortTimes(blocks)} antiEscape={antiEscape.filter((p) => p.trim())} woop={woop} />;
    footer = (
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="primary" size="lg" className="flex-1" onClick={() => finish(true)} disabled={!academic}>
          Começar o primeiro bloco
        </Button>
        <Button variant="quiet" size="lg" onClick={() => finish(false)}>
          Salvar e ir para Hoje
        </Button>
      </div>
    );
  }

  return (
    <Page className="lg:max-w-[76rem]">
      <div className="grid gap-x-14 lg:grid-cols-[minmax(0,40rem)_minmax(16rem,1fr)]">
        <div className="flex min-w-0 flex-col">
          <Flow step={Math.min(step, total - 1)} total={total} title={editing ? 'Plano do dia · editando' : 'Plano do dia'} onBack={back} onClose={() => nav('/')} className="mx-0">
            {body}
          </Flow>
          <FlowFooter>{footer}</FlowFooter>
        </div>
        <SidePanel
          sleep={sleep}
          mood={mood}
          energy={energy}
          drafts={chosen}
          blocks={sortTimes(blocks)}
          antiEscape={step >= stepKeys.indexOf('anti') ? antiEscape.filter((p) => p.trim()) : []}
          current={key}
        />
      </div>
    </Page>
  );
}

/** Rodapé do fluxo: fica acima da barra inferior no celular. */
function FlowFooter({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 mt-8 border-t border-rule bg-paper px-4 py-3 sm:-mx-8 sm:px-8 lg:bottom-0 lg:mx-0 lg:px-0 lg:pb-4">
      {children}
    </div>
  );
}

function StepCheckIn({
  sleep,
  setSleep,
  mood,
  setMood,
  energy,
  setEnergy,
  loc,
  setLoc,
}: {
  sleep: number;
  setSleep: (n: number) => void;
  mood: number | null;
  setMood: (n: number) => void;
  energy: number | null;
  setEnergy: (n: number) => void;
  loc: Loc | undefined;
  setLoc: (l: Loc | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <FlowQuestion sub="Três leituras rápidas. Elas ajustam o tamanho do dia, não o julgam.">Como você chegou hoje?</FlowQuestion>

      <div className="flex flex-col gap-2">
        <span className="t-label" id="sono-label">
          Horas de sono
        </span>
        <div className="flex items-center gap-3 border-y border-rule py-3" role="group" aria-labelledby="sono-label">
          <Button variant="secondary" size="md" className="w-12 px-0 text-xl" aria-label="Menos meia hora" disabled={sleep <= 3} onClick={() => setSleep(Math.max(3, sleep - 0.5))}>
            −
          </Button>
          <div className="flex flex-1 items-baseline justify-center gap-1.5" aria-live="polite">
            <span className="t-num t-display text-[2.75rem] leading-none text-ink">
              <SlidingNumber value={sleep} decimalSeparator="," />
            </span>
            <span className="text-ink-2">h</span>
            <span className="sr-only">{String(sleep).replace('.', ',')} horas</span>
          </div>
          <Button variant="secondary" size="md" className="w-12 px-0 text-xl" aria-label="Mais meia hora" disabled={sleep >= 11} onClick={() => setSleep(Math.min(11, sleep + 0.5))}>
            +
          </Button>
        </div>
        <p className="text-sm text-ink-3">De 3 a 11 h, em meias horas.</p>
      </div>

      <Scale label="Humor" value={mood} onChange={setMood} lowLabel="muito baixo" highLabel="muito bom" />
      <AnimatePresence initial={false}>
        {mood != null && mood <= 3 && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease }}
            className="-mt-4 overflow-hidden text-[0.9375rem] leading-relaxed text-ink-2"
          >
            Dia pesado. Dá para seguir com um plano menor, e a{' '}
            <Link to="/ajuda" className="text-ink underline">
              Ajuda
            </Link>{' '}
            está aqui se você quiser falar com alguém.
          </motion.p>
        )}
      </AnimatePresence>
      <Scale label="Energia" value={energy} onChange={setEnergy} lowLabel="sem energia" highLabel="muita" />

      <div className="flex flex-col gap-2">
        <span className="t-label">Onde você está (opcional)</span>
        <div className="flex flex-wrap gap-2">
          {LOCATIONS.map((l) => (
            <Chip key={l.value} selected={loc === l.value} onClick={() => setLoc(loc === l.value ? undefined : l.value)} className="min-h-11">
              {l.label}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepPriorities({
  drafts,
  setDrafts,
  patch,
  tasks,
  tried,
}: {
  drafts: Draft[];
  setDrafts: (fn: (xs: Draft[]) => Draft[]) => void;
  patch: (id: string, p: Partial<Draft>) => void;
  tasks: Task[];
  tried: boolean;
}) {
  const titled = drafts.filter((d) => d.title.trim());
  const noAcademic = titled.length > 0 && !titled.some((d) => d.area === 'academic');
  const ids = new Set(drafts.map((d) => d.id));
  const open = tasks.filter((t) => (t.status === 'todo' || t.status === 'doing') && !ids.has(t.id));
  const full = drafts.length >= 3;

  const take = (t: Task) =>
    setDrafts((xs) => {
      const empty = xs.findIndex((d) => !d.title.trim());
      if (empty !== -1) return xs.map((d, i) => (i === empty ? fromTask(t) : d));
      return xs.length < 3 ? [...xs, fromTask(t)] : xs;
    });

  return (
    <div className="flex flex-col gap-8">
      <FlowQuestion sub="Até três. Pelo menos uma precisa ser acadêmica.">O que importa hoje?</FlowQuestion>

      <ul className="flex flex-col">
        <AnimatePresence initial={false}>
          {drafts.map((d, i) => (
            <motion.li
              key={d.id}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease }}
              className="flex flex-col gap-3 border-t border-rule py-4 first:border-t-0 first:pt-0"
            >
              <div className="flex items-end gap-2">
                <TextField
                  label={`Prioridade ${i + 1}`}
                  placeholder={i === 0 ? 'Lista 3 de Cálculo' : 'O que mais?'}
                  value={d.title}
                  onChange={(e) => patch(d.id, { title: e.target.value })}
                  wrapClassName="flex-1"
                />
                {drafts.length > 1 && (
                  <Button variant="quiet" size="md" className="w-11 px-0" aria-label={`Remover prioridade ${i + 1}`} onClick={() => setDrafts((xs) => xs.filter((x) => x.id !== d.id))}>
                    <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden>
                      <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </Button>
                )}
              </div>
              <Segmented label={`Área da prioridade ${i + 1}`} options={AREAS} value={d.area} onChange={(v) => patch(d.id, { area: v })} className="self-start [&>button]:h-10" />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {!full && (
        <Button variant="secondary" size="md" className="self-start" onClick={() => setDrafts((xs) => [...xs, blank(xs.some((x) => x.area === 'academic') ? 'life' : 'academic')])}>
          Adicionar prioridade
        </Button>
      )}

      {(noAcademic || (tried && titled.length === 0)) && (
        <p role="alert" className="flex items-start gap-2.5 border-y border-rule py-3 text-[0.9375rem] text-ink">
          <MarkLight className="mt-0.5 shrink-0 text-light" />
          {titled.length === 0 ? 'Escreva ao menos uma prioridade acadêmica para continuar.' : 'Falta uma prioridade acadêmica. Marque uma delas como Acadêmica ou adicione outra.'}
        </p>
      )}

      {open.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="t-label">Tarefas em aberto</span>
          <ul className="flex flex-col border-t border-rule">
            {open.slice(0, 6).map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  disabled={full && drafts.every((d) => d.title.trim())}
                  onClick={() => take(t)}
                  className="flex min-h-12 w-full items-center justify-between gap-4 border-b border-rule py-2.5 text-left transition-colors hover:bg-paper-2 disabled:opacity-45"
                >
                  <span className="flex flex-col">
                    <span className="text-[0.9375rem] text-ink">{t.title}</span>
                    {t.firstStep && <span className="t-plan text-sm text-ink-3">{t.firstStep}</span>}
                  </span>
                  <span className="t-label shrink-0">{AREA_LABEL[t.area]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function suggestedTimes(now = new Date()) {
  const m = now.getHours() * 60 + now.getMinutes();
  const start = Math.ceil((m + 10) / 30) * 30;
  return Array.from({ length: 5 }, (_, i) => start + i * 60)
    .filter((x) => x < 24 * 60)
    .map(fromMin);
}

function StepBlocks({ blocks, setBlocks }: { blocks: string[]; setBlocks: (fn: (xs: string[]) => string[]) => void }) {
  const [draft, setDraft] = useState('');
  const sorted = sortTimes(blocks);
  const full = sorted.length >= 6;
  const add = (t: string) => setBlocks((xs) => (xs.includes(t) || xs.length >= 6 ? xs : sortTimes([...xs, t])));
  const suggestions = suggestedTimes().filter((t) => !blocks.includes(t));

  return (
    <div className="flex flex-col gap-8">
      <FlowQuestion sub="Escolha de 1 a 6 horários para começar um bloco de foco. Um horário marcado vira uma pista para começar.">
        Quando serão os blocos de foco?
      </FlowQuestion>

      <ol className="flex flex-col border-t border-rule" aria-label="Horários escolhidos">
        <AnimatePresence initial={false}>
          {sorted.map((t, i) => (
            <motion.li
              key={t}
              layout
              initial={{ opacity: 0, backgroundColor: 'var(--shoal)' }}
              animate={{ opacity: 1, backgroundColor: 'var(--paper)' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease }}
              className="flex min-h-12 items-center justify-between border-b border-rule pl-1"
            >
              <span className="flex items-baseline gap-4">
                <span className="t-label t-num w-14">Bloco {i + 1}</span>
                <span className="t-num t-title text-2xl text-ink">{t}</span>
              </span>
              <Button variant="quiet" size="md" onClick={() => setBlocks((xs) => xs.filter((x) => x !== t))} aria-label={`Remover ${t}`}>
                Remover
              </Button>
            </motion.li>
          ))}
        </AnimatePresence>
        {sorted.length === 0 && <li className="border-b border-rule py-3 text-ink-3">Nenhum horário ainda.</li>}
      </ol>

      {!full && suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="t-label">Sugestões a partir de agora</span>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((t) => (
              <Chip key={t} selected={false} onClick={() => add(t)} className="t-num min-h-11 px-4">
                {t}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {!full && (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (/^\d{2}:\d{2}$/.test(draft)) {
              add(draft);
              setDraft('');
            }
          }}
        >
          <TextField label="Outro horário" type="time" value={draft} onChange={(e) => setDraft(e.target.value)} wrapClassName="w-40" className="t-num" />
          <Button type="submit" variant="secondary" size="md" className="h-12" disabled={!draft}>
            Adicionar
          </Button>
        </form>
      )}
      {full && <p className="text-sm text-ink-3">Seis blocos é o máximo do dia.</p>}
    </div>
  );
}

function StepAntiEscape({
  plans,
  setPlans,
  escapeTypes,
  discreet,
}: {
  plans: string[];
  setPlans: (fn: (xs: string[]) => string[]) => void;
  escapeTypes: EscapeType[];
  discreet: boolean;
}) {
  const extra = escapeTypes.map((t) => antiEscapeFor(t, discreet)).filter((p) => !plans.includes(p));
  return (
    <div className="flex flex-col gap-8">
      <FlowQuestion sub="Decida agora o que fazer quando a vontade de fugir aparecer. Na hora, só falta seguir o plano.">Plano anti-fuga de hoje</FlowQuestion>
      <ul className="flex flex-col">
        {plans.map((p, i) => (
          <li key={i} className="flex flex-col gap-2 border-t border-rule py-4 first:border-t-0 first:pt-0">
            <IfThenField
              label={`Plano ${i + 1}`}
              value={p}
              onChange={(v) => setPlans((xs) => xs.map((x, j) => (j === i ? v : x)))}
              ifPlaceholder="eu sentir vontade de abrir o jogo"
              thenPlaceholder="aperto o SOS"
            />
            {plans.length > 1 && (
              <Button variant="quiet" size="sm" className="self-end" onClick={() => setPlans((xs) => xs.filter((_, j) => j !== i))}>
                Remover plano {i + 1}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {plans.length < 3 && (
        <div className="flex flex-col gap-2">
          <span className="t-label">Acrescentar</span>
          <div className="flex flex-wrap gap-2">
            {extra.slice(0, 3).map((p) => (
              <Chip key={p} selected={false} onClick={() => setPlans((xs) => [...xs, p])} className="min-h-11 text-left">
                {p.replace(/^Se eu sentir (vontade de |o )/, '').replace(/, então aperto o SOS$/, '')}
              </Chip>
            ))}
            <Chip selected={false} onClick={() => setPlans((xs) => [...xs, ''])} className="min-h-11">
              Plano em branco
            </Chip>
          </div>
        </div>
      )}
    </div>
  );
}

function StepWoop({ woop, setWoop, task }: { woop: Woop; setWoop: (fn: (w: Woop) => Woop) => void; task?: Draft }) {
  const set = (k: keyof Woop) => (v: string) => setWoop((w) => ({ ...w, [k]: v }));
  return (
    <div className="flex flex-col gap-7">
      <FlowQuestion sub="Opcional, 1 minuto. Imaginar o obstáculo interno junto com o plano ajuda a seguir a meta (WOOP).">
        Um WOOP para a tarefa mais difícil
      </FlowQuestion>
      {task && (
        <p className="t-title -mt-3 flex items-baseline justify-between gap-4 border-y border-rule py-3 text-lg text-ink">
          {task.title}
          <span className="t-label t-num shrink-0">incômodo {task.aversiveness ?? '–'}</span>
        </p>
      )}
      <TextField label="Desejo" placeholder="terminar a lista 3 hoje" value={woop.wish} onChange={(e) => set('wish')(e.target.value)} />
      <TextField label="Melhor resultado" placeholder="chegar na monitoria sem dúvidas acumuladas" value={woop.outcome} onChange={(e) => set('outcome')(e.target.value)} />
      <TextField label="Obstáculo interno" placeholder="achar que não vou entender e abrir o celular" value={woop.obstacle} onChange={(e) => set('obstacle')(e.target.value)} />
      <IfThenField
        label="Plano se-então para o obstáculo"
        value={woop.plan}
        onChange={set('plan')}
        ifPlaceholder={woop.obstacle || 'eu pensar que não vou entender'}
        thenPlaceholder="leio só o enunciado da questão 1"
      />
    </div>
  );
}

function StepSummary({ drafts, blocks, antiEscape, woop }: { drafts: Draft[]; blocks: string[]; antiEscape: string[]; woop: Woop }) {
  const first = drafts.find((d) => d.area === 'academic') ?? drafts[0];
  return (
    <div className="flex flex-col gap-8">
      <FlowQuestion>O rumo de hoje</FlowQuestion>
      {first && (
        <div className="-mt-3 flex flex-col gap-2 border-y border-ink py-5">
          <span className="t-label">Primeiro passo</span>
          <p className="t-display text-[clamp(1.5rem,4vw,2rem)] text-ink">{first.firstStep}</p>
          <p className="text-ink-2">{first.title}</p>
        </div>
      )}
      <ol className="flex flex-col">
        {drafts.map((d, i) => (
          <motion.li
            key={d.id}
            initial={{ opacity: 0.001, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.08 * i, ease }}
            className="grid grid-cols-[1.25rem_1fr] gap-x-3 border-b border-rule py-3"
          >
            <MarkWaypoint className={cn('mt-1', d.id === first?.id ? 'text-magenta' : 'text-ink-3')} />
            <div className="flex flex-col gap-0.5">
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-[1rem] font-[560] text-ink">{d.title}</span>
                <span className="t-label shrink-0">{AREA_LABEL[d.area]}</span>
              </span>
              {d.ifThen && <span className="t-plan text-ink-2">{d.ifThen}</span>}
            </div>
          </motion.li>
        ))}
      </ol>
      <div className="flex flex-col gap-2">
        <span className="t-label">Blocos</span>
        <p className="t-num t-title text-xl text-ink">{blocks.join('  ·  ')}</p>
      </div>
      {antiEscape.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="t-label">Anti-fuga</span>
          {antiEscape.map((p) => (
            <p key={p} className="t-plan text-ink">
              {p}
            </p>
          ))}
        </div>
      )}
      {woop.plan && (
        <div className="flex flex-col gap-1.5">
          <span className="t-label">WOOP</span>
          <p className="t-plan text-ink">{woop.plan}</p>
        </div>
      )}
    </div>
  );
}

function SidePanel({
  sleep,
  mood,
  energy,
  drafts,
  blocks,
  antiEscape,
  current,
}: {
  sleep: number | null;
  mood: number | null;
  energy: number | null;
  drafts: Draft[];
  blocks: string[];
  antiEscape: string[];
  current: string;
}) {
  if (current === 'summary') return <aside className="hidden lg:block" aria-hidden />;
  return (
    <aside className="hidden border-l border-rule pl-8 lg:block" aria-label="Rumo do dia até aqui">
      <div className="sticky top-10 flex flex-col">
        <Section label="Quarto atual" className="pt-0">
          <dl className="grid grid-cols-3 gap-4">
            {(
              [
                ['Sono', sleep != null ? `${String(sleep).replace('.', ',')}h` : '–'],
                ['Humor', mood ?? '–'],
                ['Energia', energy ?? '–'],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex flex-col gap-1">
                <dt className="t-label">{k}</dt>
                <dd className="t-num t-title text-2xl text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Section>
        <Section label="Waypoints">
          {drafts.length === 0 ? (
            <p className="text-sm text-ink-3">As prioridades aparecem aqui.</p>
          ) : (
            <ol className="flex flex-col">
              {drafts.map((d) => (
                <li key={d.id} className={cn('flex items-start gap-3 border-b border-rule py-2.5 last:border-b-0', current === `step:${d.id}` && 'text-ink')}>
                  <MarkWaypoint className={cn('mt-0.5 shrink-0', current === `step:${d.id}` ? 'text-magenta' : 'text-ink-3')} />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[0.9375rem] text-ink">{d.title}</span>
                    {d.firstStep && <span className="t-plan text-sm text-ink-2">{d.firstStep}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Section>
        {blocks.length > 0 && (
          <Section label="Blocos">
            <p className="t-num text-lg text-ink">{blocks.join('  ·  ')}</p>
          </Section>
        )}
        {antiEscape.length > 0 && (
          <Section label="Anti-fuga">
            {antiEscape.map((p) => (
              <p key={p} className="t-plan text-ink-2">
                {p}
              </p>
            ))}
          </Section>
        )}
        <p className="mt-8 text-sm leading-relaxed text-ink-3">O plano inteiro leva uns 4 minutos. Dá para voltar e editar ao longo do dia.</p>
      </div>
    </aside>
  );
}
