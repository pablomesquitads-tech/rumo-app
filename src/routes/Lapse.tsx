import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { useApp, useData } from '@/store/app';
import { Page, ScreenHeader, Section } from '@/components/ui/Screen';
import { Flow, FlowQuestion } from '@/components/ui/Flow';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Check';
import { IfThenField, TextArea, TextField, splitIfThen } from '@/components/ui/Field';
import { toast } from '@/components/ui/toast';
import { MarkTrack } from '@/components/marks/Marks';
import { ActionFooter, Cells } from '@/components/moment/kit';
import { ESCAPE_ORDER, escapeLabel } from '@/lib/defaults';
import type { EscapeType, Lapse as LapseT } from '@/lib/types';
import { addDays, dayKey, fmtDate, fmtTime, uid } from '@/lib/utils';

const ease = [0.16, 1, 0.3, 1] as const;

const VULNERABILITIES = ['Sono ruim', 'Estresse', 'Sozinho no quarto', 'Fome', 'Cansaço', 'Tédio', 'Tarefa difícil à frente', 'Sem rotina hoje'];
const TRIGGERS = ['Travei numa tarefa', 'Notificação no celular', 'Fim de um bloco', 'Cheguei em casa', 'Fui deitar', 'Fiquei sem ter o que fazer'];
const DURATIONS = [5, 15, 30, 60, 120];
const TOTAL = 8;
const COMPASSION = 'Aconteceu, e isso é dado, não um veredito sobre mim. O que eu diria a um amigo: amanhã você recomeça pelo primeiro passo.';

export default function Lapse() {
  const [params] = useSearchParams();
  const lapses = useData((d) => d.lapses);
  const discreet = useData((d) => d.settings.discreet);
  const recent = useMemo(() => [...lapses].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6), [lapses]);

  return (
    <Page className="lg:max-w-[76rem]">
      <ScreenHeader title="Lapso" meta="3 min · análise em cadeia" />
      <p className="max-w-[44rem] pt-6 text-[1.0625rem] leading-relaxed text-ink-2">
        Lapso é dado, não fracasso. A análise mostra o que puxou você e termina num novo plano se-então.
      </p>
      <div className="pt-8">
        <Wizard key={params.toString()} />
      </div>

      <Section label="Últimos lapsos" aside={recent.length ? `${recent.length} mais recentes` : undefined} className="mt-12">
        {recent.length === 0 ? (
          <p className="text-ink-3">Nenhum lapso registrado. Quando houver, a análise aparece aqui.</p>
        ) : (
          <ul className="flex flex-col">
            {recent.map((l) => (
              <li key={l.id} className="grid grid-cols-[4.5rem_1fr] gap-x-4 border-b border-rule py-3 last:border-b-0 sm:grid-cols-[6rem_12rem_1fr_auto]">
                <span className="t-num t-label text-ink">{fmtDate(l.at)}</span>
                <span className="text-ink">
                  {escapeLabel(l.type, discreet)}
                  <span className="t-num ml-2 text-sm text-ink-3">{fmtTime(l.at)}</span>
                </span>
                <span className="col-span-2 mt-1 min-w-0 truncate text-[0.9375rem] sm:col-span-1 sm:mt-0">
                  {l.chain?.newIfThen ? <span className="t-plan text-ink-2">{l.chain.newIfThen}</span> : <span className="text-ink-3">Sem análise</span>}
                </span>
                {!l.chain?.newIfThen && (
                  <Link to={`/lapso?type=${l.type}`} className="col-span-2 mt-1 inline-flex min-h-11 items-center text-ink underline sm:col-span-1 sm:mt-0">
                    Analisar em 3 min
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </Page>
  );
}

function Done({ title, children }: { title: string; children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0.001, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }} className="flex max-w-[40rem] flex-col gap-4 border-y border-ink py-8">
      <MarkTrack size={28} className="text-go" />
      <h2 className="t-display text-[clamp(1.75rem,5vw,2.5rem)] text-ink">{title}</h2>
      {children}
    </motion.div>
  );
}

function Wizard() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const upsert = useApp((s) => s.upsert);
  const lapses = useData((d) => d.lapses);
  const dayPlans = useData((d) => d.dayPlans);
  const profile = useData((d) => d.profile);
  const discreet = useData((d) => d.settings.discreet);

  const qType = params.get('type') as EscapeType | null;
  const validType = qType && ESCAPE_ORDER.includes(qType) ? qType : null;
  const existing = useMemo(() => {
    if (!validType) return undefined;
    const from = addDays(new Date(), -7).getTime();
    return [...lapses]
      .filter((l) => l.type === validType && !l.chain?.newIfThen && new Date(l.at).getTime() >= from)
      .sort((a, b) => b.at.localeCompare(a.at))[0];
  }, [lapses, validType]);

  const order = useMemo(() => {
    const mine = (profile?.escapes ?? []).map((e) => e.type);
    return [...mine, ...ESCAPE_ORDER.filter((t) => !mine.includes(t))];
  }, [profile]);

  const [step, setStep] = useState(validType ? 1 : 0);
  const [done, setDone] = useState(false);
  const [type, setType] = useState<EscapeType | null>(validType);
  const [minutes, setMinutes] = useState<number | null>(existing?.minutes ?? null);
  const [vulns, setVulns] = useState<string[]>([]);
  const [trigger, setTrigger] = useState('');
  const [thoughts, setThoughts] = useState('');
  const [behavior, setBehavior] = useState('');
  const [short, setShort] = useState('');
  const [long, setLong] = useState('');
  const [ifThen, setIfThen] = useState('');
  const [compassion, setCompassion] = useState(COMPASSION);

  const go = (n: number) => {
    setStep(Math.max(0, Math.min(TOTAL - 1, n)));
    window.scrollTo({ top: 0 });
  };
  const next = () => go(step + 1);

  const [ifPart, thenPart] = splitIfThen(ifThen);
  const planReady = ifPart.trim().length > 0 && thenPart.trim().length > 0;

  const save = () => {
    if (!type) return;
    const lapse: LapseT = {
      id: existing?.id ?? uid(),
      at: existing?.at ?? new Date().toISOString(),
      type,
      minutes: minutes ?? undefined,
      chain: {
        vulnerabilities: vulns,
        trigger: trigger.trim(),
        thoughts: thoughts.trim(),
        behavior: behavior.trim(),
        shortTermConsequence: short.trim(),
        longTermConsequence: long.trim(),
        newIfThen: ifThen.trim(),
      },
      selfCompassionNote: compassion.trim() || undefined,
    };
    upsert('lapses', lapse);
    const plan = dayPlans.find((p) => p.date === dayKey());
    if (plan && !plan.antiEscapePlans.includes(lapse.chain!.newIfThen)) upsert('dayPlans', { ...plan, antiEscapePlans: [...plan.antiEscapePlans, lapse.chain!.newIfThen] });
    toast('Análise registrada.');
    setDone(true);
  };

  if (done)
    return (
      <Done title="Isso virou um plano.">
        <p className="t-plan text-[1.25rem] text-ink">{ifThen}</p>
        <p className="text-[1.0625rem] text-ink-2">O lapso entra no seu mapa como dado. Cada análise deixa o próximo se-então mais preciso.</p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="ink" size="md" onClick={() => nav('/foco?min=12')}>
            Começar bloco de 12 min
          </Button>
          <Button variant="quiet" size="md" onClick={() => nav('/')}>
            Voltar para Hoje
          </Button>
        </div>
      </Done>
    );

  let body: ReactNode;
  let canGo = true;
  let last = false;

  if (step === 0) {
    canGo = type != null;
    body = (
      <>
        <FlowQuestion sub="Escolha o que melhor descreve.">O que aconteceu?</FlowQuestion>
        <Cells label="Tipo de lapso" value={type} onChange={setType} options={order.map((t) => ({ value: t, label: escapeLabel(t, discreet) }))} />
        <div className="mt-8 flex flex-col gap-3 border-t border-rule pt-5">
          <span className="t-label">Quanto tempo durou (opcional)</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Duração do lapso">
            {DURATIONS.map((m) => (
              <Chip key={m} selected={minutes === m} onClick={() => setMinutes(minutes === m ? null : m)} className="t-num min-h-11 px-4">
                {m} min
              </Chip>
            ))}
          </div>
        </div>
      </>
    );
  } else if (step === 1) {
    body = (
      <>
        <FlowQuestion sub="Marque o que valia naquele dia. Vulnerabilidades ajudam a prever, não a culpar.">O que já estava pesando?</FlowQuestion>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Vulnerabilidades">
          {VULNERABILITIES.map((v) => (
            <Chip key={v} selected={vulns.includes(v)} onClick={() => setVulns(vulns.includes(v) ? vulns.filter((x) => x !== v) : [...vulns, v])}>
              {v}
            </Chip>
          ))}
        </div>
      </>
    );
  } else if (step === 2) {
    body = (
      <>
        <FlowQuestion sub="O gatilho: o que aconteceu logo antes.">O que puxou?</FlowQuestion>
        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Gatilhos comuns">
          {TRIGGERS.map((t) => (
            <Chip key={t} selected={trigger === t} onClick={() => setTrigger(trigger === t ? '' : t)}>
              {t}
            </Chip>
          ))}
        </div>
        <TextField label="Com as suas palavras" placeholder="travei no exercício 4" value={trigger} onChange={(e) => setTrigger(e.target.value)} />
      </>
    );
  } else if (step === 3) {
    body = (
      <>
        <FlowQuestion sub="A frase que apareceu na cabeça e abriu a porta.">O que você pensou?</FlowQuestion>
        <TextArea label="Pensamento" placeholder="só 5 minutos" value={thoughts} onChange={(e) => setThoughts(e.target.value)} autoFocus />
      </>
    );
  } else if (step === 4) {
    body = (
      <>
        <FlowQuestion sub="Em passos curtos, do primeiro clique ao fim.">O que você fez?</FlowQuestion>
        <TextArea label="Comportamento" placeholder="abri o jogo, fui ficando" value={behavior} onChange={(e) => setBehavior(e.target.value)} autoFocus />
      </>
    );
  } else if (step === 5) {
    body = (
      <>
        <FlowQuestion sub="As duas contam: o que o lapso deu na hora e o que custou depois.">O que mudou depois?</FlowQuestion>
        <div className="flex flex-col gap-5">
          <TextArea rows={2} label="Na hora" placeholder="alívio" value={short} onChange={(e) => setShort(e.target.value)} />
          <TextArea rows={2} label="Mais tarde" placeholder="perdi a noite de estudo" value={long} onChange={(e) => setLong(e.target.value)} />
        </div>
      </>
    );
  } else if (step === 6) {
    canGo = planReady;
    const alts = profile?.altActions ?? [];
    body = (
      <>
        <FlowQuestion sub="Quando o gatilho voltar, o que você faz no lugar. Concreto e pequeno.">Novo plano se-então</FlowQuestion>
        <IfThenField
          label="Plano para a próxima vez"
          value={ifThen}
          onChange={setIfThen}
          ifPlaceholder={trigger.trim() ? trigger.trim().toLowerCase() : 'eu travar depois das 21h'}
          thenPlaceholder="levanto e vou para a sala com o notebook"
        />
        {alts.length > 0 && (
          <div className="mt-6 flex flex-col gap-3 border-t border-rule pt-5">
            <span className="t-label">Do seu cardápio de alternativas</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Alternativas">
              {alts.map((a) => (
                <Chip key={a} selected={thenPart === a.charAt(0).toLowerCase() + a.slice(1)} onClick={() => setIfThen(`Se ${ifPart.trim()}, então ${a.charAt(0).toLowerCase() + a.slice(1)}`)}>
                  {a}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </>
    );
  } else {
    last = true;
    body = (
      <>
        <FlowQuestion sub="Edite com as suas palavras. Fica guardada junto com a análise.">Uma frase de autocompaixão</FlowQuestion>
        <TextArea plan rows={4} label="Para mim, agora" value={compassion} onChange={(e) => setCompassion(e.target.value)} />
      </>
    );
  }

  return (
    <div className="grid gap-x-14 lg:grid-cols-[minmax(0,40rem)_minmax(16rem,1fr)]">
      <div className="flex min-w-0 flex-col">
        <Flow step={step} total={TOTAL} title="Análise em cadeia" onBack={() => go(step - 1)} className="mx-0">
          {body}
        </Flow>
        <ActionFooter shell>
          {last ? (
            <Button variant="primary" size="lg" block disabled={!type} onClick={save}>
              Registrar análise
            </Button>
          ) : (
            <Button variant="ink" size="lg" block disabled={!canGo} onClick={next}>
              Continuar
            </Button>
          )}
        </ActionFooter>
      </div>
      <aside className="hidden border-l border-rule pl-8 lg:block">
        <div className="sticky top-10 flex flex-col gap-3">
          <p className="t-label">Por que a análise em cadeia</p>
          <p className="text-[0.9375rem] leading-relaxed text-ink-2">
            Um lapso tem elos: vulnerabilidade, gatilho, pensamento, comportamento e consequência. Achar o elo mais fraco rende um se-então melhor do que prometer força de vontade.
          </p>
          {type && <p className="t-plan text-sm text-ink-3">{escapeLabel(type, discreet)}</p>}
        </div>
      </aside>
    </div>
  );
}
