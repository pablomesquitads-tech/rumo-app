import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useApp, useData } from '@/store/app';
import { Flow, FlowQuestion } from '@/components/ui/Flow';
import { Button } from '@/components/ui/Button';
import { Scale } from '@/components/ui/Scale';
import { Segmented } from '@/components/ui/Segmented';
import { toast } from '@/components/ui/toast';
import { MarkReturn, MarkWave } from '@/components/marks/Marks';
import {
  ActionFooter,
  Cells,
  CloseButton,
  EASE,
  MomentScreen,
  buzz,
  clock,
  readSession,
  useCalm,
  useLeave,
  useTicker,
  writeSession,
} from '@/components/moment/kit';
import { ScaleBar } from '@/components/moment/ScaleBar';
import { PEAK_AT, TideTrace, breathAt } from '@/components/moment/TideTrace';
import { ESCAPE_ORDER, escapeLabel } from '@/lib/defaults';
import { cn, dayKey, uid } from '@/lib/utils';
import type { EscapeType, Task, UrgeEvent, UrgeTool } from '@/lib/types';

type Stage = 'name' | 'intro' | 'surf' | 'reassess' | 'strong' | 'return' | 'lapsed';
const FLOW: Stage[] = ['name', 'intro', 'surf', 'reassess', 'strong', 'return'];

interface SosState {
  id: string;
  at: string;
  stage: Stage;
  type: EscapeType | null;
  before: number | null;
  after: number | null;
  tools: UrgeTool[];
  altAction?: string;
  surfMin: 3 | 4 | 5;
  surfStart: number | null;
  extraSec: number;
  delayStart: number | null;
  saved: boolean;
  updatedAt: number;
}

const KEY = 'rumo.sos';
const FREE_STEP_KEY = 'rumo.focus.freeStep';
const DELAY_MS = 10 * 60_000;
const STILL_STRONG = 5;

function fresh(type: EscapeType | null): SosState {
  return {
    id: uid(),
    at: new Date().toISOString(),
    stage: 'name',
    type,
    before: null,
    after: null,
    tools: [],
    surfMin: 3,
    surfStart: null,
    extraSec: 0,
    delayStart: null,
    saved: false,
    updatedAt: Date.now(),
  };
}

function restore(type: EscapeType | null): SosState {
  const s = readSession<SosState>(KEY);
  if (s && s.stage !== 'lapsed' && Date.now() - s.updatedAt < 30 * 60_000) return s;
  return fresh(type);
}

const withTool = (tools: UrgeTool[], t: UrgeTool) => (tools.includes(t) ? tools : [...tools, t]);

export default function Sos() {
  const [params] = useSearchParams();
  const qType = params.get('type') as EscapeType | null;
  const nav = useNavigate();
  const leave = useLeave();
  const upsert = useApp((s) => s.upsert);
  const discreet = useData((d) => d.settings.discreet);

  const [s, setS] = useState<SosState>(() => restore(qType && ESCAPE_ORDER.includes(qType) ? qType : null));
  const patch = (p: Partial<SosState>) => setS((prev) => ({ ...prev, ...p, updatedAt: Date.now() }));

  useEffect(() => {
    writeSession(KEY, s);
  }, [s]);

  const save = (outcome: UrgeEvent['outcome'], st: SosState = s) => {
    if (!st.type || st.before == null) return;
    upsert('urges', {
      id: st.id,
      at: st.at,
      type: st.type,
      intensityBefore: st.before,
      intensityAfter: st.after ?? undefined,
      toolsUsed: st.tools,
      altAction: st.altAction,
      outcome,
    });
  };

  const go = (stage: Stage, extra: Partial<SosState> = {}) => {
    const next = { ...s, ...extra, stage, saved: s.saved || Boolean(s.type && s.before != null), updatedAt: Date.now() };
    save('unknown', next);
    setS(next);
    window.scrollTo({ top: 0 });
  };

  const close = () => {
    save('unknown');
    writeSession(KEY, null);
    leave('/');
  };

  const lapsed = () => {
    save('lapsed');
    patch({ stage: 'lapsed' });
  };

  const finish = (to: string) => {
    save('resisted');
    writeSession(KEY, null);
    nav(to, { replace: true });
  };

  if (s.stage === 'lapsed') return <Lapsed type={s.type} onClose={() => leave('/')} />;

  const idx = FLOW.indexOf(s.stage);
  const back: Partial<Record<Stage, Stage>> = {
    intro: 'name',
    reassess: 'intro',
    strong: 'reassess',
    return: s.after != null && s.after >= STILL_STRONG ? 'strong' : 'reassess',
  };
  const lapseLink = (
    <button
      type="button"
      onClick={lapsed}
      className="t-cond mt-1 min-h-11 w-full text-center text-[0.9375rem] font-[560] text-ink-2 underline decoration-rule-2 underline-offset-4 hover:text-ink"
    >
      Aconteceu / já fiz
    </button>
  );

  return (
    <MomentScreen>
      <Flow
        step={idx}
        total={FLOW.length}
        onBack={back[s.stage] ? () => go(back[s.stage] as Stage) : undefined}
        onClose={close}
        className={cn('flex-1 px-4 pt-4 sm:px-8 sm:pt-8', s.stage === 'surf' && 'max-w-[60rem]')}
        footer={
          <div className="pb-[env(safe-area-inset-bottom)]">
            {s.stage === 'name' && (
              <Button variant="primary" size="lg" block disabled={!s.type || s.before == null} onClick={() => go('intro')}>
                Continuar
              </Button>
            )}
            {s.stage === 'intro' && (
              <div className="flex flex-col gap-2">
                <Button
                  variant="primary"
                  size="lg"
                  block
                  onClick={() => go('surf', { surfStart: Date.now(), extraSec: 0, tools: withTool(s.tools, 'surf') })}
                >
                  Começar a observar
                </Button>
                <Button variant="quiet" block onClick={() => go('reassess')}>
                  Pular a observação
                </Button>
              </div>
            )}
            {s.stage === 'surf' && <SurfActions s={s} onExtra={() => patch({ extraSec: Math.min(180, s.extraSec + 60), tools: withTool(s.tools, 'breath') })} onNext={(keepSurf) => go('reassess', keepSurf ? {} : { tools: s.tools.filter((t) => t !== 'surf') })} />}
            {s.stage === 'reassess' && (
              <Button variant="primary" size="lg" block disabled={s.after == null} onClick={() => go(s.after != null && s.after >= STILL_STRONG ? 'strong' : 'return')}>
                Continuar
              </Button>
            )}
            {s.stage === 'strong' && (
              <Button variant="primary" size="lg" block onClick={() => go('return')}>
                Continuar
              </Button>
            )}
            {s.stage === 'return' && <ReturnActions onStart={(taskId) => finish(taskId ? `/foco?task=${taskId}&min=12` : '/foco?min=12')} onLater={() => finish('/')} />}
            {s.stage !== 'return' && lapseLink}
          </div>
        }
      >
        {s.stage === 'name' && <NameStep s={s} discreet={discreet} patch={patch} />}
        {s.stage === 'intro' && <IntroStep s={s} patch={patch} />}
        {s.stage === 'surf' && <SurfStep s={s} />}
        {s.stage === 'reassess' && <ReassessStep s={s} patch={patch} />}
        {s.stage === 'strong' && <StrongStep s={s} patch={patch} />}
        {s.stage === 'return' && <ReturnStep />}
      </Flow>
    </MomentScreen>
  );
}

type StepProps = { s: SosState; patch: (p: Partial<SosState>) => void };

function NameStep({ s, patch, discreet }: StepProps & { discreet: boolean }) {
  const escapes = useData((d) => d.profile?.escapes);
  const order = useMemo(() => {
    const mine = (escapes ?? []).map((e) => e.type);
    return [...mine, ...ESCAPE_ORDER.filter((t) => !mine.includes(t))];
  }, [escapes]);

  return (
    <>
      <FlowQuestion>O que está puxando você?</FlowQuestion>
      <Cells
        label="Tipo de impulso"
        value={s.type}
        onChange={(type) => patch({ type })}
        options={order.map((t) => ({ value: t, label: escapeLabel(t, discreet) }))}
      />
      <Scale
        className="mt-8"
        label="Intensidade agora"
        tone="magenta"
        value={s.before}
        onChange={(before) => patch({ before })}
        lowLabel="Fraca"
        highLabel="Muito forte"
      />
    </>
  );
}

function IntroStep({ s, patch }: StepProps) {
  return (
    <>
      <FlowQuestion sub={`Vamos observá-la por ${s.surfMin} minutos.`}>Você não precisa obedecer nem lutar contra essa vontade.</FlowQuestion>
      <div className="flex flex-col gap-6 border-t border-rule pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="t-label">Duração</span>
          <Segmented
            label="Duração da observação"
            value={String(s.surfMin) as '3' | '4' | '5'}
            onChange={(v) => patch({ surfMin: Number(v) as 3 | 4 | 5 })}
            options={[
              { value: '3', label: '3 min' },
              { value: '4', label: '4 min' },
              { value: '5', label: '5 min' },
            ]}
          />
        </div>
        <p className="flex max-w-[32rem] gap-3 text-[1.0625rem] leading-relaxed text-ink-2">
          <MarkWave size={22} className="mt-0.5 shrink-0 text-sea" />
          <span>Uma vontade sobe, chega a um pico e desce, como uma onda. Você vai acompanhar a sua, respirando devagar.</span>
        </p>
      </div>
    </>
  );
}

const PHASES = [
  { until: 0.12, title: 'Onde a sensação aparece no corpo?', sub: 'Peito, mãos, estômago, rosto. Só repare, sem mudar nada.' },
  { until: 0.26, title: 'Como é a forma dela?', sub: 'Quente, apertada, inquieta, pulsando? Dê um nome, sem julgar.' },
  { until: PEAK_AT - 0.03, title: 'Ela está subindo.', sub: 'Você não precisa fazer nada com ela. Respire e acompanhe.' },
  { until: 0.56, title: 'Este é o pico.', sub: 'Fique com a sensação, sem obedecer. Você só está observando.' },
  { until: 0.8, title: 'Está descendo.', sub: 'Repare no que mudou no corpo desde o começo.' },
  { until: 1, title: 'Deixe passar.', sub: 'A onda segue o caminho dela. Você continua aqui.' },
];

function surfClock(s: SosState, now: number) {
  const base = s.surfMin * 60;
  const total = base + s.extraSec;
  const elapsed = Math.min(total, Math.max(0, (now - (s.surfStart ?? now)) / 1000));
  return { base, total, elapsed, done: elapsed >= total };
}

function SurfStep({ s }: { s: SosState }) {
  const calm = useCalm();
  const now = useTicker(true, 250);
  const { base, total, elapsed, done } = surfClock(s, now);
  const breath = breathAt(elapsed);

  const doneRef = useRef(done);
  useEffect(() => {
    if (done && !doneRef.current) buzz([18, 80, 18]);
    doneRef.current = done;
  }, [done]);

  const phase = done
    ? { key: 'done', title: 'A onda passou.', sub: 'Quando quiser, continue.' }
    : elapsed >= base
      ? { key: 'breath', title: 'Só a respiração agora.', sub: 'Inspire em 4, expire em 6.' }
      : (() => {
          const i = PHASES.findIndex((p) => elapsed / base < p.until);
          const p = PHASES[i === -1 ? PHASES.length - 1 : i];
          return { key: p.title, ...p };
        })();

  return (
    <div className="flex flex-col">
      <div className="min-h-[7.5rem] sm:min-h-[8.5rem]" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={phase.key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="flex flex-col gap-2"
          >
            <h1 className="t-display text-[clamp(1.625rem,5vw,2.5rem)] text-ink">{phase.title}</h1>
            <p className="max-w-[34rem] text-[1.0625rem] leading-relaxed text-ink-2">{phase.sub}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {calm ? (
        <ScaleBar className="mt-6" progress={elapsed / total} minutes={Math.round(total / 60)} label="Tempo de observação" />
      ) : (
        <TideTrace
          className="mt-2"
          startedAt={s.surfStart ?? now}
          baseSec={base}
          totalSec={total}
          intensity={s.before ?? 6}
          elapsedSec={elapsed}
        />
      )}

      <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-rule pt-3">
        <p className="flex items-baseline gap-2" aria-live="off">
          <span className="t-title text-xl text-ink">{done ? 'Respire normalmente' : breath.phase === 'in' ? 'Inspire' : 'Expire'}</span>
          {!done && <span className="t-num t-label">{breath.left} s</span>}
        </p>
        <span className="t-num t-label" aria-label="Tempo restante">
          {clock((total - elapsed) * 1000).label}
        </span>
      </div>
    </div>
  );
}

function SurfActions({ s, onExtra, onNext }: { s: SosState; onExtra: () => void; onNext: (keepSurf: boolean) => void }) {
  const now = useTicker(true, 500);
  const { elapsed, done } = surfClock(s, now);
  const canExtra = s.extraSec < 180;
  if (done)
    return (
      <div className="flex flex-col gap-2">
        <Button variant="primary" size="lg" block onClick={() => onNext(true)}>
          Continuar
        </Button>
        {canExtra && (
          <Button variant="quiet" block onClick={onExtra}>
            Mais 1 minuto de respiração
          </Button>
        )}
      </div>
    );
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="quiet" size="lg" onClick={() => onNext(elapsed >= 30)}>
        Pular
      </Button>
      <Button variant="secondary" size="lg" disabled={!canExtra} onClick={onExtra}>
        Mais 1 minuto
      </Button>
    </div>
  );
}

function ReassessStep({ s, patch }: StepProps) {
  const b = s.before ?? 0;
  const a = s.after;
  const note =
    a == null
      ? null
      : a < b
        ? 'A vontade mudou enquanto você observava.'
        : a === b
          ? 'Ficou igual. Tudo bem: ela ainda pode mudar.'
          : 'Subiu um pouco. Isso acontece; o próximo passo ajuda.';
  return (
    <>
      <FlowQuestion>E agora, qual a intensidade?</FlowQuestion>
      <Scale label="Intensidade agora" tone="magenta" value={a} onChange={(after) => patch({ after })} lowLabel="Fraca" highLabel="Muito forte" />
      <AnimatePresence>
        {a != null && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="mt-8 flex flex-col gap-2 border-t border-rule pt-6"
          >
            <p className="t-display t-num text-[clamp(2.25rem,8vw,3.5rem)] text-ink">
              de {b} para {a}
            </p>
            <p className="text-[1.0625rem] text-ink-2">{note}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function StrongStep({ s, patch }: StepProps) {
  const setProfile = useApp((st) => st.setProfile);
  const alts = useData((d) => d.profile?.altActions) ?? [];
  const [draft, setDraft] = useState('');
  const now = useTicker(s.delayStart != null, 500);
  const left = s.delayStart != null ? DELAY_MS - (now - s.delayStart) : DELAY_MS;
  const delayDone = s.delayStart != null && left <= 0;

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!alts.includes(v)) setProfile({ altActions: [...alts, v] });
    patch({ altAction: v, tools: withTool(s.tools, 'alt_action') });
    setDraft('');
    toast('Adicionada ao cardápio.');
  };

  return (
    <>
      <FlowQuestion sub="Escolha um jeito de atravessar: esperar, ou fazer outra coisa com o corpo.">Ainda está forte. Tudo bem.</FlowQuestion>

      <section className="flex flex-col gap-4 border-t border-ink pt-5" aria-labelledby="sos-delay">
        <h2 id="sos-delay" className="t-title text-xl text-ink">
          Espere 10 minutos, depois decida.
        </h2>
        {s.delayStart == null ? (
          <Button variant="secondary" size="lg" className="self-start" onClick={() => patch({ delayStart: Date.now(), tools: withTool(s.tools, 'delay') })}>
            Começar 10 minutos
          </Button>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <span className="t-display t-num text-[2.5rem] text-ink">{clock(left).label}</span>
              <span className="text-sm text-ink-3">{delayDone ? 'Passou. Decida com calma.' : 'Pode sair desta tela; o tempo continua.'}</span>
            </div>
            <ScaleBar progress={1 - left / DELAY_MS} minutes={10} label="Adiamento de 10 minutos" />
          </div>
        )}
      </section>

      <section className="mt-10 flex flex-col gap-3" aria-labelledby="sos-alt">
        <h2 id="sos-alt" className="t-title border-b border-rule pb-3 text-xl text-ink">
          Ou faça uma destas
        </h2>
        <div role="radiogroup" aria-labelledby="sos-alt" className="flex flex-col">
          {alts.map((a) => {
            const on = s.altAction === a;
            return (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => patch({ altAction: on ? undefined : a, tools: on ? s.tools.filter((t) => t !== 'alt_action') : withTool(s.tools, 'alt_action') })}
                className="flex min-h-12 items-center gap-3.5 border-b border-rule py-2.5 text-left transition-colors hover:bg-paper-2"
              >
                <span
                  aria-hidden
                  className={cn('grid size-5 shrink-0 place-items-center rounded-full border', on ? 'border-ink' : 'border-ink-3')}
                >
                  {on && <span className="size-2.5 rounded-full bg-ink" />}
                </span>
                <span className={cn('text-[1rem]', on ? 'font-[600] text-ink' : 'text-ink')}>{a}</span>
              </button>
            );
          })}
        </div>
        <form
          className="flex gap-2 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label htmlFor="sos-new-alt" className="sr-only">
            Nova alternativa
          </label>
          <input
            id="sos-new-alt"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Adicionar uma (ex.: lavar a louça)"
            className="h-12 min-w-0 flex-1 rounded-[3px] border border-rule-2 bg-paper px-3.5 text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none"
          />
          <Button type="submit" variant="secondary" className="h-12" disabled={!draft.trim()}>
            Adicionar
          </Button>
        </form>
      </section>
    </>
  );
}

function useCurrentTask(): Task | undefined {
  const today = dayKey();
  const plan = useData((d) => d.dayPlans.find((p) => p.date === today));
  const tasks = useData((d) => d.tasks);
  return useMemo(
    () =>
      (plan?.priorities ?? [])
        .map((id) => tasks.find((t) => t.id === id))
        .find((t): t is Task => Boolean(t) && t!.status !== 'done' && t!.status !== 'dropped'),
    [plan, tasks],
  );
}

function ReturnStep() {
  const task = useCurrentTask();
  const upsert = useApp((st) => st.upsert);
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState(() => task?.firstStep ?? readSession<string>(FREE_STEP_KEY) ?? '');

  useEffect(() => {
    if (!task) writeSession(FREE_STEP_KEY, step.trim() || null);
  }, [task, step]);

  const commit = () => {
    if (task && step.trim() && step.trim() !== task.firstStep) upsert('tasks', { ...task, firstStep: step.trim() });
    setEditing(false);
  };

  return (
    <>
      <FlowQuestion>Qual é o passo de 2 minutos da sua tarefa?</FlowQuestion>
      {task && !editing ? (
        <div className="flex flex-col gap-4 border-t border-ink pt-5">
          <p className="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
            <span className="t-label shrink-0">Tarefa</span>
            <span className="text-right text-ink-2">{task.title}</span>
          </p>
          <p className="flex gap-3 t-title text-[clamp(1.5rem,5vw,2rem)] text-ink">
            <MarkReturn size={24} className="mt-1.5 shrink-0 text-sea" />
            <span>{task.firstStep || task.title}</span>
          </p>
          <Button variant="quiet" size="sm" className="self-start" onClick={() => setEditing(true)}>
            Ajustar o passo
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 border-t border-ink pt-5">
          <label htmlFor="sos-step" className="t-label">
            O passo de 2 minutos
          </label>
          <input
            id="sos-step"
            autoFocus={editing}
            value={step}
            onChange={(e) => setStep(e.target.value)}
            onBlur={task ? commit : undefined}
            onKeyDown={(e) => e.key === 'Enter' && task && commit()}
            placeholder="Ex.: abrir o PDF da lista 3 na primeira questão"
            className="h-14 w-full rounded-[3px] border border-rule-2 bg-paper px-3.5 text-[1.0625rem] text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none"
          />
          <p className="text-sm text-ink-3">Algo físico e pequeno: abrir, escrever uma linha, ler um parágrafo.</p>
        </div>
      )}
    </>
  );
}

function ReturnActions({ onStart, onLater }: { onStart: (taskId?: string) => void; onLater: () => void }) {
  const task = useCurrentTask();
  return (
    <div className="flex flex-col gap-2">
      <Button variant="primary" size="lg" block onClick={() => onStart(task?.id)}>
        Começar bloco de 12 min
      </Button>
      <Button variant="quiet" block onClick={onLater}>
        Agora não
      </Button>
    </div>
  );
}

function Lapsed({ type, onClose }: { type: EscapeType | null; onClose: () => void }) {
  const nav = useNavigate();
  const to = `/lapso?${type ? `type=${type}&` : ''}from=sos`;
  return (
    <MomentScreen>
      <div className="mx-auto flex w-full max-w-[40rem] flex-1 flex-col px-4 pt-4 sm:px-8 sm:pt-8">
        <div className="flex justify-end">
          <CloseButton onClick={onClose} />
        </div>
        <motion.div
          initial={{ opacity: 0.001, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="flex flex-1 flex-col justify-center gap-4 pb-10"
        >
          <h1 className="t-display text-[clamp(2.25rem,8vw,3.5rem)] text-ink">Ok, aconteceu.</h1>
          <p className="max-w-[30rem] text-[1.125rem] leading-relaxed text-ink-2">
            Vamos aprender com isso. Uma análise curta mostra o que puxou você e termina com um plano para a próxima vez.
          </p>
        </motion.div>
        <ActionFooter>
          <div className="flex flex-col gap-2">
            <Button variant="primary" size="lg" block onClick={() => nav(to, { replace: true })}>
              Fazer a análise agora
            </Button>
            <Button variant="quiet" block onClick={onClose}>
              Agora não
            </Button>
          </div>
        </ActionFooter>
      </div>
    </MomentScreen>
  );
}
