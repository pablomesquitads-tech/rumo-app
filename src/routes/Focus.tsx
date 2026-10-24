import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { useApp, useData } from '@/store/app';
import { Flow, FlowQuestion } from '@/components/ui/Flow';
import { Button } from '@/components/ui/Button';
import { Check, Chip } from '@/components/ui/Check';
import { Scale } from '@/components/ui/Scale';
import { Sheet } from '@/components/ui/Dialog';
import { toast } from '@/components/ui/toast';
import { MarkLight, MarkReturn } from '@/components/marks/Marks';
import {
  ActionFooter,
  Cells,
  CloseButton,
  EASE,
  MomentScreen,
  buzz,
  chime,
  clock,
  readSession,
  unlockAudio,
  useDocumentTitle,
  useLeave,
  useTicker,
  useWakeLock,
  writeSession,
} from '@/components/moment/kit';
import { ScaleBar } from '@/components/moment/ScaleBar';
import { FOCUS_PRESETS } from '@/lib/defaults';
import { focusMinutesOn } from '@/lib/metrics';
import type { FocusSession, Task } from '@/lib/types';
import { dayKey, uid } from '@/lib/utils';

type Stage = 'setup' | 'work' | 'rate' | 'break' | 'stopped';
const FLOW: Stage[] = ['setup', 'work', 'rate'];

interface FocusState {
  id: string;
  stage: Stage;
  taskId?: string;
  plannedMin: number;
  breakMin: number;
  startMs: number | null;
  breakStartMs: number | null;
  env: boolean[];
  distractions: number;
  rating: number | null;
  reward?: string;
  updatedAt: number;
}

const KEY = 'rumo.focus';
const ENV_ITEMS = ['Celular longe da mesa, com notificações silenciadas', 'Jogos, redes e abas de fuga fechados', 'Água e material de estudo à mão'];
const STOP_REASONS = ['Impulso forte', 'Cansaço', 'Interrupção', 'Outro'];

function breakFor(plannedMin: number, d: { workMin: number; breakMin: number }): number {
  if (plannedMin === d.workMin) return d.breakMin;
  return FOCUS_PRESETS.find((p) => p.workMin === plannedMin)?.breakMin ?? Math.max(3, Math.round(plannedMin / 5));
}

function fresh(taskId: string | undefined, min: number | undefined): FocusState {
  const d = useApp.getState().data.profile?.focusDefaults ?? { workMin: 25, breakMin: 5 };
  const plannedMin = min && min >= 1 && min <= 120 ? Math.round(min) : d.workMin;
  return {
    id: uid(),
    stage: 'setup',
    taskId,
    plannedMin,
    breakMin: breakFor(plannedMin, d),
    startMs: null,
    breakStartMs: null,
    env: ENV_ITEMS.map(() => false),
    distractions: 0,
    rating: null,
    updatedAt: Date.now(),
  };
}

function restore(taskId: string | undefined, min: number | undefined): FocusState {
  const s = readSession<FocusState>(KEY);
  if (s && (s.stage === 'work' || s.stage === 'rate') && Date.now() - s.updatedAt < 3 * 3_600_000 && (!taskId || s.taskId === taskId)) return s;
  return fresh(taskId, min);
}

export default function Focus() {
  const [params] = useSearchParams();
  const qTask = params.get('task') ?? undefined;
  const qMin = Number(params.get('min')) || undefined;
  const leave = useLeave();
  const nav = useNavigate();
  const upsert = useApp((st) => st.upsert);
  const profile = useData((d) => d.profile);
  const sessions = useData((d) => d.focusSessions);

  const [s, setS] = useState<FocusState>(() => restore(qTask, qMin));
  const [stopping, setStopping] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const task = useData((d) => d.tasks.find((t) => t.id === s.taskId));

  const patch = (p: Partial<FocusState>) => setS((prev) => ({ ...prev, ...p, updatedAt: Date.now() }));

  useEffect(() => {
    writeSession(KEY, s);
  }, [s]);

  const working = s.stage === 'work';
  const now = useTicker(working || s.stage === 'break', 250);
  const total = s.plannedMin * 60_000;
  const leftMs = s.startMs != null ? s.startMs + total - now : total;
  const workDone = working && leftMs <= 0;
  const breakLeft = s.breakStartMs != null ? s.breakStartMs + s.breakMin * 60_000 - now : 0;
  const breakDone = s.stage === 'break' && breakLeft <= 0;

  useWakeLock(working);
  useDocumentTitle(working ? `${clock(leftMs).label} · Rumo` : null);

  const record = (st: FocusState, extra: Partial<FocusSession> = {}) => {
    if (st.startMs == null) return;
    upsert('focusSessions', {
      id: st.id,
      taskId: st.taskId,
      start: new Date(st.startMs).toISOString(),
      plannedMin: st.plannedMin,
      breakMin: st.breakMin,
      completed: false,
      distractionsTapped: st.distractions,
      envChecklist: st.env,
      focusRating: st.rating ?? undefined,
      reward: st.reward,
      ...extra,
    });
  };

  useEffect(() => {
    if (!workDone) return;
    const next: FocusState = { ...s, stage: 'rate', updatedAt: Date.now() };
    record(next, { completed: true, end: new Date().toISOString() });
    chime();
    buzz([18, 80, 18]);
    setS(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workDone]);

  const breakChimed = useRef(false);
  useEffect(() => {
    if (breakDone && !breakChimed.current) {
      breakChimed.current = true;
      chime();
      buzz([18, 80, 18]);
    }
  }, [breakDone]);

  const begin = () => {
    unlockAudio();
    const next: FocusState = { ...s, stage: 'work', startMs: Date.now(), updatedAt: Date.now() };
    record(next);
    if (task && task.status === 'todo') upsert('tasks', { ...task, status: 'doing' });
    window.scrollTo({ top: 0 });
    setS(next);
  };

  const urge = () => {
    const next = { ...s, distractions: s.distractions + 1, updatedAt: Date.now() };
    record(next);
    writeSession(KEY, next);
    nav('/sos');
  };

  const stop = () => {
    const next: FocusState = { ...s, stage: 'stopped', updatedAt: Date.now() };
    record(next, { end: new Date().toISOString(), abandonedReason: reason ?? undefined });
    setStopping(false);
    setS(next);
  };

  const register = () => {
    const nextBase = { ...s, updatedAt: Date.now() };
    record(nextBase, { completed: true, end: new Date(s.startMs! + total).toISOString() });
    toast('Bloco registrado.');
    if (s.breakMin > 0) {
      window.scrollTo({ top: 0 });
      setS({ ...nextBase, stage: 'break', breakStartMs: Date.now() });
      return;
    }
    writeSession(KEY, null);
    leave('/');
  };

  const close = () => {
    writeSession(KEY, null);
    leave('/');
  };

  const again = (min?: number) => {
    breakChimed.current = false;
    setS(fresh(s.taskId, min ?? s.plannedMin));
    window.scrollTo({ top: 0 });
  };

  const completeTask = (t: Task) => {
    upsert('tasks', { ...t, status: 'done', doneAt: new Date().toISOString() });
    toast('Waypoint alcançado.');
  };

  if (s.stage === 'stopped') {
    const done = s.startMs != null ? Math.min(s.plannedMin, Math.round((Date.now() - s.startMs) / 60_000)) : 0;
    return (
      <Closing
        onClose={close}
        footer={
          <div className="flex flex-col gap-2">
            <Button variant="primary" size="lg" block onClick={() => again(12)}>
              Recomeçar com 12 min
            </Button>
            <Button variant="quiet" block onClick={close}>
              Voltar para Hoje
            </Button>
          </div>
        }
      >
        <h1 className="t-display text-[clamp(2.25rem,8vw,3.5rem)] text-ink">Bloco parcial registrado.</h1>
        <p className="t-num max-w-[30rem] text-[1.125rem] leading-relaxed text-ink-2">
          {done} min de foco ficam no seu dia. Parcial conta; o próximo bloco pode ser menor.
        </p>
      </Closing>
    );
  }

  if (s.stage === 'break') {
    const todayMin = focusMinutesOn({ focusSessions: sessions }, dayKey());
    return (
      <Closing
        onClose={close}
        footer={
          <div className="flex flex-col gap-2">
            <Button variant="primary" size="lg" block onClick={() => again()}>
              Outro bloco de {s.plannedMin} min
            </Button>
            {task && task.status !== 'done' && (
              <Button variant="secondary" size="lg" block onClick={() => completeTask(task)}>
                Concluir tarefa
              </Button>
            )}
            <Button variant="quiet" block onClick={close}>
              Terminar por agora
            </Button>
          </div>
        }
      >
        <p className="t-label">Pausa</p>
        <h1 className="t-display t-num text-[clamp(3.5rem,16vw,7rem)] text-ink">{clock(breakLeft).label}</h1>
        <ScaleBar progress={s.breakStartMs != null ? 1 - breakLeft / (s.breakMin * 60_000) : 0} minutes={s.breakMin} label="Tempo de pausa" />
        <p className="max-w-[30rem] text-[1.0625rem] leading-relaxed text-ink-2">
          {breakDone ? 'A pausa acabou. Quando quiser, o próximo bloco começa pelo primeiro passo.' : 'Levante, beba água, olhe longe. Telas de fuga ficam de fora.'}
        </p>
        <p className="t-num border-t border-rule pt-3 text-sm text-ink-3">Hoje: {todayMin} min de foco.</p>
      </Closing>
    );
  }

  const idx = FLOW.indexOf(s.stage);
  const durations = FOCUS_PRESETS.some((p) => p.workMin === s.plannedMin)
    ? FOCUS_PRESETS.map((p) => ({ value: p.workMin as number, label: `${p.workMin} min`, hint: `${p.breakMin} de pausa` }))
    : [
        { value: s.plannedMin, label: `${s.plannedMin} min`, hint: `${s.breakMin} de pausa` },
        ...FOCUS_PRESETS.map((p) => ({ value: p.workMin as number, label: `${p.workMin} min`, hint: `${p.breakMin} de pausa` })),
      ];
  const step = task?.firstStep || task?.title;

  return (
    <MomentScreen>
      <Flow
        step={idx}
        total={FLOW.length}
        onClose={s.stage === 'work' ? () => setStopping(true) : close}
        className="flex-1 px-4 pt-4 sm:px-8 sm:pt-8"
        footer={
          <div className="pb-[env(safe-area-inset-bottom)]">
            {s.stage === 'setup' && (
              <Button variant="primary" size="lg" block onClick={begin}>
                Começar bloco de {s.plannedMin} min
              </Button>
            )}
            {s.stage === 'work' && (
              <div className="flex flex-col gap-2">
                <Button variant="primary" size="lg" block onClick={urge}>
                  Veio um impulso
                </Button>
                <Button variant="quiet" block onClick={() => setStopping(true)}>
                  Parar o bloco
                </Button>
              </div>
            )}
            {s.stage === 'rate' && (
              <Button variant="primary" size="lg" block disabled={s.rating == null} onClick={register}>
                Registrar bloco
              </Button>
            )}
          </div>
        }
      >
        {s.stage === 'setup' && (
          <>
            <FlowQuestion sub={task ? task.title : 'Bloco livre: sem tarefa ligada.'}>{step ? 'Seu primeiro passo' : 'Quanto tempo agora?'}</FlowQuestion>
            {step && (
              <p className="t-title mb-8 flex gap-3 border-t border-ink pt-5 text-[clamp(1.5rem,5vw,2rem)] text-ink">
                <MarkReturn size={24} className="mt-1.5 shrink-0 text-sea" />
                <span>{step}</span>
              </p>
            )}
            {task?.ifThen && <p className="t-plan -mt-4 mb-8 text-[1.0625rem] text-sea">{task.ifThen}</p>}
            <Cells
              label="Duração do bloco"
              cols={4}
              value={s.plannedMin}
              onChange={(plannedMin) => patch({ plannedMin, breakMin: breakFor(plannedMin, profile?.focusDefaults ?? { workMin: 25, breakMin: 5 }) })}
              options={durations}
            />
            <section className="mt-8 flex flex-col" aria-labelledby="focus-env">
              <h2 id="focus-env" className="t-label border-b border-rule pb-2">
                Ambiente
              </h2>
              {ENV_ITEMS.map((label, i) => (
                <Check key={label} checked={s.env[i]} onChange={(v) => patch({ env: s.env.map((x, j) => (j === i ? v : x)) })}>
                  {label}
                </Check>
              ))}
            </section>
          </>
        )}

        {s.stage === 'work' && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <p className="t-label">{task?.title ?? 'Bloco livre'}</p>
              {step && <p className="t-title text-[clamp(1.25rem,4vw,1.75rem)] text-ink">{step}</p>}
            </div>
            <p className="t-display t-num text-[clamp(4rem,20vw,8.5rem)] leading-none text-ink" role="timer" aria-label="Tempo restante">
              {clock(leftMs).label}
            </p>
            <ScaleBar progress={s.startMs != null ? 1 - leftMs / total : 0} minutes={s.plannedMin} label="Progresso do bloco" />
            <p className="flex max-w-[34rem] gap-3 border-t border-rule pt-4 text-[1.0625rem] leading-relaxed text-ink-2">
              <MarkLight size={22} className="mt-0.5 shrink-0 text-sea" />
              <span>Se vier vontade de sair, o SOS está a um toque. O tempo do bloco continua.</span>
            </p>
          </div>
        )}

        {s.stage === 'rate' && (
          <>
            <FlowQuestion sub="Registrar leva 10 segundos e alimenta o seu progresso.">
              {s.plannedMin} min de foco concluídos.
            </FlowQuestion>
            <Scale label="Quão focado você esteve?" value={s.rating} onChange={(rating) => patch({ rating })} lowLabel="Disperso" highLabel="Muito focado" />
            {(profile?.rewards.length ?? 0) > 0 && (
              <div className="mt-8 flex flex-col gap-3 border-t border-rule pt-5">
                <span className="t-label">Recompensa curta (opcional)</span>
                <div className="flex flex-wrap gap-2">
                  {profile?.rewards.map((r) => (
                    <Chip key={r} selected={s.reward === r} onClick={() => patch({ reward: s.reward === r ? undefined : r })}>
                      {r}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Flow>

      <Sheet open={stopping} onClose={() => setStopping(false)} title="Parar o bloco agora?">
        <div className="flex flex-col gap-4 text-ink-2">
          <p>O tempo feito até aqui fica registrado como bloco parcial.</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Motivo">
            {STOP_REASONS.map((r) => (
              <Chip key={r} selected={reason === r} onClick={() => setReason(reason === r ? null : r)}>
                {r}
              </Chip>
            ))}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="quiet" onClick={() => setStopping(false)}>
              Continuar o bloco
            </Button>
            <Button variant="ink" onClick={stop}>
              Encerrar bloco
            </Button>
          </div>
        </div>
      </Sheet>
    </MomentScreen>
  );
}

function Closing({ children, footer, onClose }: { children: ReactNode; footer: ReactNode; onClose: () => void }) {
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
          {children}
        </motion.div>
        <ActionFooter>{footer}</ActionFooter>
      </div>
    </MomentScreen>
  );
}
