import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import { useApp, useData } from '@/store/app';
import { Page, ScreenHeader, Section, Empty } from '@/components/ui/Screen';
import { Flow, FlowQuestion } from '@/components/ui/Flow';
import { Button } from '@/components/ui/Button';
import { IfThenField, TextArea, TextField } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { toast } from '@/components/ui/toast';
import { MarkLight, MarkLog } from '@/components/marks/Marks';
import { escapeLabel } from '@/lib/defaults';
import { blocksOn, focusMinutesOn, focusSeries, plannedStartedRate, sessionMinutes, urgeStats } from '@/lib/metrics';
import type { Review as ReviewT } from '@/lib/types';
import { addDays, cn, dayKey, fmtDate, fmtTime, sameDay, uid } from '@/lib/utils';

type Tab = 'noturna' | 'semanal';
const ease = [0.16, 1, 0.3, 1] as const;

const COMPASSION = {
  mindful: 'Hoje foi difícil em alguns momentos, e tudo bem notar isso.',
  common: 'Muita gente com TDAH passa por isso; não estou sozinho.',
  kind: 'O que eu diria a um amigo agora: amanhã você recomeça pelo primeiro passo.',
};

function minusMinutes(hhmm: string, n: number) {
  const [h, m] = hhmm.split(':').map(Number);
  const t = (((h * 60 + m - n) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export default function Review() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tipo') === 'semanal' ? 'semanal' : 'noturna';
  const reviews = useData((d) => d.reviews);
  const recent = useMemo(() => [...reviews].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6), [reviews]);
  const isSunday = new Date().getDay() === 0;

  return (
    <Page className="lg:max-w-[76rem]">
      <ScreenHeader
        title="Revisão"
        meta={tab === 'noturna' ? '3 min · antes de dormir' : `15 min · ${isSunday ? 'hoje é domingo' : 'melhor no domingo'}`}
      />
      <Segmented<Tab>
        label="Tipo de revisão"
        className="mt-6 w-full max-w-[22rem] [&>button]:h-11"
        options={[
          { value: 'noturna', label: 'Noturna' },
          { value: 'semanal', label: 'Semanal' },
        ]}
        value={tab}
        onChange={(v) => setParams(v === 'semanal' ? { tipo: 'semanal' } : {}, { replace: true })}
      />
      <div className="pt-8">{tab === 'noturna' ? <Evening key="n" /> : <Weekly key="s" />}</div>

      <Section label="Últimas revisões" aside={recent.length ? `${recent.length} mais recentes` : undefined} className="mt-12">
        {recent.length === 0 ? (
          <p className="text-ink-3">Nenhuma revisão ainda. A primeira aparece aqui.</p>
        ) : (
          <ul className="flex flex-col">
            {recent.map((r) => (
              <li key={r.id} className="grid grid-cols-[4.5rem_1fr] gap-x-4 border-b border-rule py-3 last:border-b-0 sm:grid-cols-[6rem_6rem_1fr_auto]">
                <span className="t-num t-label text-ink">{fmtDate(r.at)}</span>
                <span className="t-label">{r.kind === 'weekly' ? 'Semanal' : 'Noturna'}</span>
                <span className="col-span-2 mt-1 min-w-0 truncate text-[0.9375rem] text-ink-2 sm:col-span-1 sm:mt-0">
                  {r.kind === 'weekly' ? r.valuesReflection || r.tomorrowIfThen || 'Sem anotações' : r.win || r.worked || 'Sem anotações'}
                </span>
                {r.bedtime && <span className="t-num hidden text-sm text-ink-3 sm:block">dormir {r.bedtime}</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>
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

function Layout({ flow, aside }: { flow: ReactNode; aside: ReactNode }) {
  return (
    <div className="grid gap-x-14 lg:grid-cols-[minmax(0,40rem)_minmax(16rem,1fr)]">
      <div className="flex min-w-0 flex-col">{flow}</div>
      <aside className="hidden border-l border-rule pl-8 lg:block">
        <div className="sticky top-10 flex flex-col">{aside}</div>
      </aside>
    </div>
  );
}

function Done({ title, children }: { title: string; children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0.001, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }} className="flex max-w-[40rem] flex-col gap-4 border-y border-ink py-8">
      <MarkLog size={28} className="text-go" />
      <h2 className="t-display text-[clamp(1.75rem,5vw,2.5rem)] text-ink">{title}</h2>
      {children}
    </motion.div>
  );
}

/* ---------- Noturna ---------- */

function Evening() {
  const nav = useNavigate();
  const upsert = useApp((s) => s.upsert);
  const today = dayKey();
  const profile = useData((d) => d.profile);
  const sessions = useData((d) => d.focusSessions);
  const lapses = useData((d) => d.lapses);
  const tasks = useData((d) => d.tasks);
  const discreet = useData((d) => d.settings.discreet);
  const existing = useData((d) => d.reviews.find((r) => r.kind === 'evening' && sameDay(r.at)));

  const todaySessions = sessions.filter((s) => dayKey(s.start) === today).sort((a, b) => a.start.localeCompare(b.start));
  const minutes = focusMinutesOn({ focusSessions: sessions }, today);
  const { completed } = blocksOn({ focusSessions: sessions }, today);
  const todayLapses = lapses.filter((l) => sameDay(l.at));
  const unanalyzed = todayLapses.filter((l) => !l.chain?.newIfThen);
  const openAcademic = tasks.find((t) => t.area === 'academic' && (t.status === 'todo' || t.status === 'doing'));

  const parts = existing?.selfCompassion?.split(' / ');
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [win, setWin] = useState(existing?.win ?? '');
  const [worked, setWorked] = useState(existing?.worked ?? '');
  const [mindful, setMindful] = useState(parts?.[0] ?? COMPASSION.mindful);
  const [common, setCommon] = useState(parts?.[1] ?? COMPASSION.common);
  const [kind, setKind] = useState(parts?.[2] ?? COMPASSION.kind);
  const [ifThen, setIfThen] = useState(existing?.tomorrowIfThen ?? (openAcademic?.firstStep ? `Se , então ${openAcademic.firstStep}` : ''));
  const [bedtime, setBedtime] = useState(existing?.bedtime ?? profile?.bedtimeTarget ?? '23:30');

  const total = 7;
  const go = (n: number) => {
    setStep(Math.max(0, Math.min(total - 1, n)));
    window.scrollTo({ top: 0 });
  };
  const next = () => go(step + 1);

  const save = () => {
    const r: ReviewT = {
      id: existing?.id ?? uid(),
      at: existing?.at ?? new Date().toISOString(),
      kind: 'evening',
      win: win.trim() || undefined,
      worked: worked.trim() || undefined,
      selfCompassion: [mindful, common, kind].map((x) => x.trim()).join(' / '),
      tomorrowIfThen: ifThen.trim() || undefined,
      bedtime,
    };
    upsert('reviews', r);
    toast('Revisão registrada.');
    setDone(true);
  };

  if (done)
    return (
      <Done title="Boa noite.">
        <p className="text-[1.0625rem] text-ink-2">
          Telas de lazer desligadas às <span className="t-num text-ink">{minusMinutes(bedtime, 60)}</span>, dormir às{' '}
          <span className="t-num text-ink">{bedtime}</span>.
        </p>
        {ifThen && <p className="t-plan text-lg text-ink">{ifThen}</p>}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="ink" size="md" onClick={() => nav('/')}>
            Voltar para Hoje
          </Button>
          <Button variant="quiet" size="md" onClick={() => setDone(false)}>
            Editar revisão
          </Button>
        </div>
      </Done>
    );

  let body: ReactNode;
  let footer: ReactNode = (
    <Button variant="ink" size="lg" block onClick={next}>
      Continuar
    </Button>
  );

  if (step === 0) {
    body = (
      <>
        <FlowQuestion sub="Leitura automática dos blocos de hoje.">
          {completed === 0 ? 'Nenhum bloco concluído hoje' : `${completed} ${completed === 1 ? 'bloco concluído' : 'blocos concluídos'} hoje`}
        </FlowQuestion>
        {todaySessions.length === 0 ? (
          <p className="border-y border-rule py-4 text-ink-2">Sem blocos registrados. Um dia não apaga o caminho feito; amanhã o plano recomeça pelo primeiro passo.</p>
        ) : (
          <ul className="flex flex-col border-t border-rule">
            {todaySessions.map((s) => {
              const t = tasks.find((x) => x.id === s.taskId);
              return (
                <li key={s.id} className="grid grid-cols-[3.5rem_1fr_auto] items-baseline gap-x-4 border-b border-rule py-3">
                  <span className="t-num text-ink-2">{fmtTime(s.start)}</span>
                  <span className="min-w-0 truncate text-ink">{t?.title ?? 'Bloco livre'}</span>
                  <span className={cn('t-label t-num', s.completed ? 'text-go' : 'text-ink-3')}>
                    {sessionMinutes(s)} min{s.completed ? '' : ' · parcial'}
                  </span>
                </li>
              );
            })}
            <li className="flex items-baseline justify-between py-3">
              <span className="t-label">Total</span>
              <span className="t-num t-title text-2xl text-ink">{minutes} min</span>
            </li>
          </ul>
        )}
      </>
    );
  } else if (step === 1) {
    body = (
      <>
        <FlowQuestion sub="Pode ser pequena: abrir o PDF conta.">Uma vitória de hoje</FlowQuestion>
        <TextArea label="Vitória" placeholder="comecei a lista mesmo sem vontade" value={win} onChange={(e) => setWin(e.target.value)} autoFocus />
      </>
    );
  } else if (step === 2) {
    body = (
      <>
        <FlowQuestion sub="Um lugar, um horário, um ajuste de ambiente. Isso vira o plano de amanhã.">O que funcionou?</FlowQuestion>
        <TextArea label="O que funcionou" placeholder="celular em outro cômodo durante o bloco" value={worked} onChange={(e) => setWorked(e.target.value)} autoFocus />
      </>
    );
  } else if (step === 3) {
    body = (
      <>
        <FlowQuestion sub="Opcional. Lapso é dado, não fracasso.">Houve algum lapso hoje?</FlowQuestion>
        {todayLapses.length === 0 ? (
          <div className="flex flex-col gap-3 border-y border-rule py-4">
            <p className="text-ink-2">Nenhum lapso registrado hoje.</p>
            <Link to="/lapso" className="self-start text-ink underline">
              Registrar um lapso
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col border-t border-rule">
            {todayLapses.map((l) => (
              <li key={l.id} className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-rule py-3">
                <span className="flex items-baseline gap-3">
                  <span className="t-num text-ink-2">{fmtTime(l.at)}</span>
                  <span className="text-ink">{escapeLabel(l.type, discreet)}</span>
                </span>
                {l.chain?.newIfThen ? (
                  <span className="t-plan text-sm text-ink-2">{l.chain.newIfThen}</span>
                ) : (
                  <Link to={`/lapso?type=${l.type}`} className="text-ink underline">
                    Analisar em 3 min
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
        {unanalyzed.length > 0 && (
          <p className="mt-4 flex items-start gap-2.5 text-[0.9375rem] text-ink-2">
            <MarkLight className="mt-0.5 shrink-0 text-light" />
            Uma análise curta transforma o lapso num novo se-então. Pode ser agora ou amanhã.
          </p>
        )}
      </>
    );
    footer = (
      <Button variant="ink" size="lg" block onClick={next}>
        {todayLapses.length ? 'Continuar' : 'Pular'}
      </Button>
    );
  } else if (step === 4) {
    body = (
      <>
        <FlowQuestion sub="Três partes: notar, lembrar que é humano, ser gentil. Edite com as suas palavras.">Uma frase de autocompaixão</FlowQuestion>
        <div className="flex flex-col gap-5">
          <TextArea plan rows={2} label="Atenção plena" value={mindful} onChange={(e) => setMindful(e.target.value)} />
          <TextArea plan rows={2} label="Humanidade comum" value={common} onChange={(e) => setCommon(e.target.value)} />
          <TextArea plan rows={2} label="Gentileza" value={kind} onChange={(e) => setKind(e.target.value)} />
        </div>
      </>
    );
  } else if (step === 5) {
    body = (
      <>
        <FlowQuestion sub="Quando e onde você dá o primeiro passo amanhã.">Se-então para amanhã</FlowQuestion>
        <IfThenField label="Plano de amanhã" value={ifThen} onChange={setIfThen} ifPlaceholder="forem 9h e eu terminar o café" />
      </>
    );
  } else {
    body = (
      <>
        <FlowQuestion sub="Sono curto piora atenção e controle no dia seguinte.">Que horas você vai dormir?</FlowQuestion>
        <div className="flex flex-col gap-2">
          <label htmlFor="bed" className="t-label">
            Dormir às
          </label>
          <input
            id="bed"
            type="time"
            value={bedtime}
            onChange={(e) => e.target.value && setBedtime(e.target.value)}
            className="t-num t-display h-20 w-full max-w-[14rem] rounded-[3px] border border-rule-2 bg-paper px-4 text-[2.5rem] text-ink focus:border-ink focus:outline-none"
          />
        </div>
        <p className="mt-6 border-y border-rule py-4 text-ink-2">
          Desligue telas de lazer (jogos, redes) às <span className="t-num font-[600] text-ink">{minusMinutes(bedtime, 60)}</span>, 60 min antes.
          {profile?.bedtimeTarget && bedtime !== profile.bedtimeTarget && (
            <span className="mt-1 block text-sm text-ink-3">Seu horário-alvo é {profile.bedtimeTarget}.</span>
          )}
        </p>
      </>
    );
    footer = (
      <Button variant="primary" size="lg" block onClick={save}>
        {existing ? 'Atualizar revisão' : 'Registrar revisão'}
      </Button>
    );
  }

  return (
    <Layout
      flow={
        <>
          <Flow step={step} total={total} title="Revisão noturna" onBack={() => go(step - 1)} className="mx-0">
            {body}
          </Flow>
          <FlowFooter>{footer}</FlowFooter>
        </>
      }
      aside={
        <>
          <Section label="Hoje" className="pt-0">
            <dl className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <dt className="t-label">Foco</dt>
                <dd className="t-num t-title text-2xl text-ink">{minutes} min</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="t-label">Blocos</dt>
                <dd className="t-num t-title text-2xl text-ink">{completed}</dd>
              </div>
            </dl>
          </Section>
          {win && (
            <Section label="Vitória">
              <p className="text-ink">{win}</p>
            </Section>
          )}
          <Section label="Antes de dormir">
            <p className="text-sm leading-relaxed text-ink-2">
              Alvo <span className="t-num text-ink">{profile?.bedtimeTarget ?? '23:30'}</span>. Telas de lazer desligadas 60 min antes.
            </p>
          </Section>
        </>
      }
    />
  );
}

/* ---------- Semanal ---------- */

const WEEKDAY = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });

function topCounts(items: string[], n: number) {
  const m = new Map<string, { label: string; c: number }>();
  items
    .map((x) => x.trim())
    .filter(Boolean)
    .forEach((x) => {
      const k = x.toLowerCase();
      const cur = m.get(k);
      m.set(k, { label: cur?.label ?? x, c: (cur?.c ?? 0) + 1 });
    });
  return [...m.values()].sort((a, b) => b.c - a.c).slice(0, n);
}

function weekStart() {
  const from = addDays(new Date(), -6);
  from.setHours(0, 0, 0, 0);
  return from.getTime();
}

function Weekly() {
  const nav = useNavigate();
  const upsert = useApp((s) => s.upsert);
  const data = useData((d) => d);
  const reduced = data.settings.reducedMotion;
  const from = weekStart();
  const existing = data.reviews.find((r) => r.kind === 'weekly' && new Date(r.at).getTime() >= from);

  const series = useMemo(
    () =>
      focusSeries(data, 7).map((x) => {
        const d = new Date(`${x.date}T12:00:00`);
        return { ...x, label: WEEKDAY.format(d).replace('.', ''), today: x.date === dayKey() };
      }),
    [data],
  );
  const weekMin = series.reduce((a, x) => a + x.minutes, 0);
  const startedPct = plannedStartedRate(data, 7);
  const urges = urgeStats(data, 7);

  const openProblems = data.problems.filter((p) => p.status !== 'resolved');
  const resolved = data.problems.filter((p) => p.status === 'resolved' && p.resolvedAt && new Date(p.resolvedAt).getTime() >= from);

  const weekLapses = data.lapses.filter((l) => new Date(l.at).getTime() >= from);
  const triggers = topCounts(weekLapses.map((l) => l.chain?.trigger ?? ''), 3);
  const vulns = topCounts(weekLapses.flatMap((l) => l.chain?.vulnerabilities ?? []), 3);

  const lastScreening = [...data.screenings].sort((a, b) => b.at.localeCompare(a.at))[0];
  const screeningDue = !lastScreening || Date.now() - new Date(lastScreening.at).getTime() >= 30 * 86_400_000;

  const savedPlans = existing?.notes?.split('\n') ?? [];
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [plan1, setPlan1] = useState(existing?.tomorrowIfThen ?? (triggers[0] ? `Se ${triggers[0].label.toLowerCase()}, então ` : ''));
  const [plan2, setPlan2] = useState(savedPlans.find((l) => l.startsWith('Se ') && l !== existing?.tomorrowIfThen) ?? '');
  const [env, setEnv] = useState(savedPlans.find((l) => l.startsWith('Ambiente: '))?.slice(10) ?? '');
  const [values, setValues] = useState(existing?.valuesReflection ?? '');

  const total = 6;
  const go = (n: number) => {
    setStep(Math.max(0, Math.min(total - 1, n)));
    window.scrollTo({ top: 0 });
  };
  const next = () => go(step + 1);

  const save = () => {
    const p1 = plan1.trim();
    const notes = [p1, plan2.trim(), env.trim() && `Ambiente: ${env.trim()}`].filter(Boolean).join('\n');
    upsert('reviews', {
      id: existing?.id ?? uid(),
      at: existing?.at ?? new Date().toISOString(),
      kind: 'weekly',
      tomorrowIfThen: p1 || undefined,
      notes: notes || undefined,
      valuesReflection: values.trim() || undefined,
    });
    toast('Revisão semanal registrada.');
    setDone(true);
  };

  if (done)
    return (
      <Done title="Semana revisada.">
        {plan1 && <p className="t-plan text-lg text-ink">{plan1}</p>}
        {plan2 && <p className="t-plan text-lg text-ink">{plan2}</p>}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="ink" size="md" onClick={() => nav('/')}>
            Voltar para Hoje
          </Button>
          <Button variant="quiet" size="md" onClick={() => setDone(false)}>
            Editar revisão
          </Button>
        </div>
      </Done>
    );

  let body: ReactNode;
  let footer: ReactNode = (
    <Button variant="ink" size="lg" block onClick={next}>
      Continuar
    </Button>
  );

  if (step === 0) {
    body = (
      <>
        <FlowQuestion sub="Minutos de foco por dia, últimos 7 dias.">Como foi a semana</FlowQuestion>
        <div className="h-56 w-full" role="img" aria-label={`Minutos de foco por dia: ${series.map((s) => `${s.label} ${s.minutes}`).join(', ')}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
              <XAxis
                dataKey="label"
                axisLine={{ stroke: 'var(--rule)' }}
                tickLine={false}
                tick={{ fill: 'var(--ink-2)', fontSize: 12, fontWeight: 600 }}
                interval={0}
              />
              <YAxis
                axisLine={{ stroke: 'var(--rule)' }}
                tickLine={false}
                tick={{ fill: 'var(--ink-3)', fontSize: 11, style: { fontVariantNumeric: 'tabular-nums' } }}
                allowDecimals={false}
                width={40}
              />
              <Tooltip cursor={{ fill: 'var(--paper-3)' }} content={<MinutesTip />} />
              <Bar dataKey="minutes" fill="var(--sea)" radius={[2, 2, 0, 0]} maxBarSize={36} isAnimationActive={!reduced} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-rule pt-4">
          <Stat label="Foco" value={`${weekMin}`} unit="min" />
          <Stat label="Blocos iniciados" value={startedPct == null ? '–' : `${startedPct}`} unit={startedPct == null ? '' : '% do plano'} />
          <Stat label="Impulsos atravessados" value={`${urges.resisted}`} unit={`de ${urges.total}`} />
        </dl>
      </>
    );
  } else if (step === 1) {
    body = (
      <>
        <FlowQuestion sub="Os problemas que estavam debaixo do tapete.">Caixa de problemas</FlowQuestion>
        <dl className="grid grid-cols-2 gap-4 border-y border-rule py-4">
          <Stat label="Em aberto" value={`${openProblems.length}`} />
          <Stat label="Resolvidos na semana" value={`${resolved.length}`} />
        </dl>
        {resolved.length > 0 && (
          <ul className="mt-4 flex flex-col">
            {resolved.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-3 border-b border-rule py-2.5">
                <span className="text-ink">{p.title}</span>
                <span className="t-num t-label">{fmtDate(p.resolvedAt!)}</span>
              </li>
            ))}
          </ul>
        )}
        {openProblems.length > 0 && (
          <p className="mt-4 text-ink-2">
            O de maior custo agora: <span className="text-ink">{[...openProblems].sort((a, b) => b.costScore * b.discomfort - a.costScore * a.discomfort)[0].title}</span>
          </p>
        )}
        <Link to="/caixa" className="mt-4 inline-flex min-h-11 items-center text-ink underline">
          Abrir a Caixa
        </Link>
      </>
    );
  } else if (step === 2) {
    body = (
      <>
        <FlowQuestion sub="Dos lapsos analisados nos últimos 7 dias.">O gatilho mais frequente</FlowQuestion>
        {weekLapses.length === 0 ? (
          <p className="border-y border-rule py-4 text-ink-2">Nenhum lapso registrado nesta semana.</p>
        ) : triggers.length === 0 && vulns.length === 0 ? (
          <div className="flex flex-col gap-3 border-y border-rule py-4">
            <p className="text-ink-2">
              {weekLapses.length} {weekLapses.length === 1 ? 'lapso registrado' : 'lapsos registrados'}, ainda sem análise em cadeia.
            </p>
            <Link to="/lapso" className="self-start text-ink underline">
              Analisar um lapso
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {triggers[0] && (
              <div className="flex flex-col gap-1 border-y border-ink py-5">
                <span className="t-label">Gatilho</span>
                <p className="t-display text-[clamp(1.5rem,4vw,2rem)] text-ink">{triggers[0].label}</p>
                <span className="t-num text-sm text-ink-3">
                  {triggers[0].c} de {weekLapses.length} {weekLapses.length === 1 ? 'lapso' : 'lapsos'}
                </span>
              </div>
            )}
            {triggers.length > 1 && <Counts label="Outros gatilhos" items={triggers.slice(1)} />}
            {vulns.length > 0 && <Counts label="Vulnerabilidades" items={vulns} />}
          </div>
        )}
      </>
    );
  } else if (step === 3) {
    body = (
      <>
        <FlowQuestion sub="Um ou dois planos novos, ou uma mudança no ambiente que deixe a fuga mais cara.">O que muda na próxima semana?</FlowQuestion>
        <div className="flex flex-col gap-6">
          <IfThenField label="Plano 1" value={plan1} onChange={setPlan1} ifPlaceholder="for 22h e eu estiver no quarto" thenPlaceholder="deixo o celular carregando na sala" />
          <IfThenField label="Plano 2 (opcional)" value={plan2} onChange={setPlan2} />
          <TextField label="Mudança de ambiente (opcional)" placeholder="desinstalar o jogo do notebook de estudo" value={env} onChange={(e) => setEnv(e.target.value)} />
        </div>
      </>
    );
  } else if (step === 4) {
    const vals = data.profile?.values ?? [];
    body = (
      <>
        <FlowQuestion sub="Valores são direções, não metas: não se cumprem, se seguem.">A semana foi na direção dos seus valores?</FlowQuestion>
        {vals.length > 0 ? (
          <ul className="mb-6 flex flex-wrap gap-x-5 gap-y-2 border-y border-rule py-4">
            {vals.map((v) => (
              <li key={v} className="t-title text-lg text-ink">
                {v}
              </li>
            ))}
          </ul>
        ) : (
          <div className="mb-6">
            <Empty title="Nenhum valor registrado." action={<Link to="/ajustes" className="text-ink underline">Definir valores em Ajustes</Link>} />
          </div>
        )}
        <TextArea
          label="Onde chegou perto, onde se afastou"
          placeholder="estudei para a prova porque quero ser um bom engenheiro; me afastei quando virei a noite jogando"
          value={values}
          onChange={(e) => setValues(e.target.value)}
          rows={4}
        />
        {vals.length > 0 && (
          <Link to="/ajustes" className="mt-3 inline-flex min-h-11 items-center text-sm text-ink-2 underline">
            Ajustar valores
          </Link>
        )}
      </>
    );
  } else {
    body = (
      <>
        <FlowQuestion sub="Uma vez por mês, a triagem de humor e ansiedade ajuda a perceber quando vale procurar um profissional.">Triagem de humor</FlowQuestion>
        {screeningDue ? (
          <div className="flex flex-col gap-3 border-y border-rule py-4">
            <p className="text-ink-2">{lastScreening ? `A última foi em ${fmtDate(lastScreening.at, { day: '2-digit', month: 'long' })}.` : 'Você ainda não fez a triagem.'} Leva uns 2 minutos.</p>
            <Link to="/ajuda" className="self-start text-ink underline">
              Fazer a triagem em Ajuda
            </Link>
          </div>
        ) : (
          <p className="border-y border-rule py-4 text-ink-2">
            Última triagem em {fmtDate(lastScreening.at, { day: '2-digit', month: 'long' })}. A próxima fica para depois de{' '}
            {fmtDate(addDays(new Date(lastScreening.at), 30), { day: '2-digit', month: 'long' })}.
          </p>
        )}
      </>
    );
    footer = (
      <Button variant="primary" size="lg" block onClick={save}>
        {existing ? 'Atualizar revisão semanal' : 'Registrar revisão semanal'}
      </Button>
    );
  }

  return (
    <Layout
      flow={
        <>
          <Flow step={step} total={total} title="Revisão semanal" onBack={() => go(step - 1)} className="mx-0">
            {body}
          </Flow>
          <FlowFooter>{footer}</FlowFooter>
        </>
      }
      aside={
        <>
          <Section label="Semana" className="pt-0">
            <dl className="grid grid-cols-2 gap-4">
              <Stat label="Foco" value={`${weekMin}`} unit="min" />
              <Stat label="Lapsos" value={`${weekLapses.length}`} />
            </dl>
          </Section>
          {existing?.tomorrowIfThen && (
            <Section label="Plano da semana">
              <p className="t-plan text-ink-2">{existing.tomorrowIfThen}</p>
            </Section>
          )}
          <p className="mt-8 text-sm leading-relaxed text-ink-3">Feedback e revisão de metas, uma vez por semana. Sem nota, sem ranking: só o que ajustar.</p>
        </>
      }
    />
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="t-label">{label}</dt>
      <dd className="flex flex-wrap items-baseline gap-1.5">
        <span className="t-num t-title text-2xl text-ink">{value}</span>
        {unit && <span className="text-sm text-ink-2">{unit}</span>}
      </dd>
    </div>
  );
}

function Counts({ label, items }: { label: string; items: { label: string; c: number }[] }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="t-label">{label}</span>
      <ul className="flex flex-col">
        {items.map((x) => (
          <li key={x.label} className="flex items-baseline justify-between gap-3 border-b border-rule py-2.5 last:border-b-0">
            <span className="text-ink">{x.label}</span>
            <span className="t-num text-ink-2">{x.c}×</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MinutesTip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as { date: string; minutes: number };
  return (
    <div className="rounded-[3px] border border-rule bg-paper px-3 py-2 text-sm">
      <p className="t-label">{fmtDate(`${p.date}T12:00:00`, { weekday: 'long', day: '2-digit' })}</p>
      <p className="t-num text-ink">{p.minutes} min</p>
    </div>
  );
}
