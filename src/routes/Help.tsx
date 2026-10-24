import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useApp, useData } from '@/store/app';
import { escapeLabel, ESCAPE_ORDER, HELP } from '@/lib/defaults';
import { blocksOn, focusMovingAvg7, focusSeries, sleepHours, urgeStats } from '@/lib/metrics';
import {
  alerts,
  ANSWERS,
  bandLabel,
  buildScreening,
  INSTRUMENTS,
  isScreeningDue,
  lastScreening,
  nextScreeningDue,
  STEM,
  type Instrument,
} from '@/lib/screening';
import type { AppData, Contacts, Screening } from '@/lib/types';
import { addDays, cn, dayKey, fmtDate, uid } from '@/lib/utils';
import { MarkRescue } from '@/components/marks/Marks';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { Flow, FlowQuestion } from '@/components/ui/Flow';
import { Page, ScreenHeader, Section } from '@/components/ui/Screen';
import { toast } from '@/components/ui/toast';

type View =
  | { kind: 'home' }
  | { kind: 'screen'; instrument: Instrument; step: number; answers: number[] }
  | { kind: 'support'; screening: Screening }
  | { kind: 'result'; screening: Screening }
  | { kind: 'report' };

const SECTIONS = [
  { id: 'agora', label: 'Ligar agora' },
  { id: 'contatos', label: 'Seus contatos' },
  { id: 'triagens', label: 'Triagens' },
  { id: 'quando', label: 'Quando procurar ajuda' },
  { id: 'relatorio', label: 'Relatório' },
];

export default function Help() {
  const [view, setView] = useState<View>({ kind: 'home' });
  const upsert = useApp((s) => s.upsert);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view.kind]);

  if (view.kind === 'screen') {
    const inst = INSTRUMENTS[view.instrument];
    const answer = (v: number) => {
      const answers = [...view.answers.slice(0, view.step), v];
      if (view.step < inst.items.length - 1) return setView({ ...view, step: view.step + 1, answers });
      const s = buildScreening(view.instrument, answers, uid());
      upsert('screenings', s);
      setView(alerts(view.instrument, answers).urgent ? { kind: 'support', screening: s } : { kind: 'result', screening: s });
    };
    return (
      <Page>
        <Flow
          step={view.step}
          total={inst.items.length}
          title={inst.name}
          onBack={() => setView({ ...view, step: view.step - 1 })}
          onClose={() => setView({ kind: 'home' })}
        >
          <FlowQuestion sub={STEM}>{inst.items[view.step]}</FlowQuestion>
          <div className="flex flex-col border-t border-rule" role="radiogroup" aria-label="Frequência">
            {ANSWERS.map((a, v) => {
              const on = view.answers[view.step] === v;
              return (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => answer(v)}
                  className={cn(
                    'flex min-h-14 items-center justify-between gap-4 border-b border-rule px-1 text-left text-[1.0625rem] transition-colors hover:bg-paper-2',
                    on && 'font-[620] text-ink',
                  )}
                >
                  <span>{a}</span>
                  <span className={cn('t-num t-label', on && 'text-magenta')}>{v}</span>
                </button>
              );
            })}
          </div>
        </Flow>
      </Page>
    );
  }

  if (view.kind === 'support') return <Support onContinue={() => setView({ kind: 'result', screening: view.screening })} />;
  if (view.kind === 'result') return <Result screening={view.screening} onDone={() => setView({ kind: 'home' })} />;
  if (view.kind === 'report') return <Report onBack={() => setView({ kind: 'home' })} />;

  return (
    <Page>
      <ScreenHeader
        title="Ajuda e segurança"
        description="Se o momento está pesado demais, ligue agora. O resto desta tela pode esperar."
      />
      <TocLayout sections={SECTIONS}>
        <Section id="agora" label="Ligar agora" className="scroll-mt-24">
          <CallLinks />
          <p className="text-sm text-ink-3">
            O CVV também atende por chat em{' '}
            <a href="https://cvv.org.br" target="_blank" rel="noopener noreferrer" className="text-ink underline">
              cvv.org.br
            </a>
            . Em perigo imediato, vá ao pronto-socorro mais próximo.
          </p>
        </Section>

        <Section id="contatos" label="Seus contatos" className="scroll-mt-24">
          <ContactsEditor />
        </Section>

        <Section id="triagens" label="Triagens mensais" aside="PHQ-9 e GAD-7" className="scroll-mt-24">
          <Screenings onStart={(instrument) => setView({ kind: 'screen', instrument, step: 0, answers: [] })} />
        </Section>

        <Section id="quando" label="Quando vale procurar ajuda" className="scroll-mt-24">
          <WhenToSeek />
        </Section>

        <Section id="relatorio" label="Relatório para o profissional" className="scroll-mt-24">
          <p className="max-w-[40rem] text-ink-2">
            Um resumo dos últimos 30 dias para levar à consulta: foco, impulsos, lapsos, sono e triagens. Abre numa página pronta para imprimir ou salvar em PDF.
          </p>
          <div>
            <Button variant="secondary" onClick={() => setView({ kind: 'report' })}>
              Abrir relatório de 30 dias
            </Button>
          </div>
        </Section>
      </TocLayout>
    </Page>
  );
}

/** Índice fixo à esquerda (notebook) + conteúdo; no celular, pilha simples. */
export function TocLayout({ sections, children }: { sections: { id: string; label: string }[]; children: ReactNode }) {
  const [active, setActive] = useState(sections[0]?.id);
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => Boolean(e));
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: '-15% 0px -70% 0px' },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [sections]);

  return (
    <div className="lg:grid lg:grid-cols-[12rem_1fr] lg:gap-12">
      <nav aria-label="Nesta página" className="hidden lg:block">
        <ul className="sticky top-10 flex flex-col border-l border-rule pt-8">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={() => setActive(s.id)}
                aria-current={active === s.id ? 'location' : undefined}
                className={cn(
                  '-ml-px flex min-h-10 items-center border-l py-1.5 pl-4 text-[0.9375rem] transition-colors',
                  active === s.id ? 'border-magenta font-[620] text-ink' : 'border-transparent text-ink-2 hover:text-ink',
                )}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function CallLinks({ trusted }: { trusted?: boolean }) {
  const contact = useData((d) => d.profile?.contacts.trusted);
  const phone = contact ? telOf(contact) : null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <a
        href={`tel:${HELP.cvv.number}`}
        className="group flex min-h-24 items-center justify-between gap-4 rounded-[3px] bg-magenta px-5 py-4 text-magenta-ink transition-[filter] hover:brightness-110"
      >
        <span className="flex flex-col">
          <span className="text-lg font-[700] t-cond">Ligar para o CVV</span>
          <span className="text-sm opacity-90">{HELP.cvv.note}</span>
        </span>
        <span className="t-display t-num text-[2.75rem] leading-none">{HELP.cvv.number}</span>
      </a>
      <a
        href={`tel:${HELP.samu.number}`}
        className="flex min-h-24 items-center justify-between gap-4 rounded-[3px] border border-ink px-5 py-4 text-ink transition-colors hover:bg-paper-2"
      >
        <span className="flex flex-col">
          <span className="text-lg font-[700] t-cond">Ligar para o SAMU</span>
          <span className="text-sm text-ink-2">{HELP.samu.note}</span>
        </span>
        <span className="t-display t-num text-[2.75rem] leading-none">{HELP.samu.number}</span>
      </a>
      {trusted && contact && (
        <a
          href={phone ? `tel:${phone}` : undefined}
          className="flex min-h-16 items-center justify-between gap-4 border-y border-rule px-1 py-3 text-ink sm:col-span-2"
        >
          <span className="flex flex-col">
            <span className="t-label">Pessoa de confiança</span>
            <span className="text-[1.0625rem]">{contact}</span>
          </span>
          {phone && <span className="t-cond font-[650]">Ligar</span>}
        </a>
      )}
    </div>
  );
}

/** Extrai um número discável de texto livre ("Ana, (11) 9 1234-5678"). */
function telOf(s: string): string | null {
  const digits = s.replace(/[^\d+]/g, '');
  return digits.replace(/\D/g, '').length >= 3 ? digits : null;
}

const CONTACT_FIELDS: { key: keyof Contacts; label: string; placeholder: string }[] = [
  { key: 'psychology', label: 'Psicologia da universidade', placeholder: 'Serviço-escola, (11) 0000-0000' },
  { key: 'psychiatrist', label: 'Psiquiatra', placeholder: 'Nome e telefone' },
  { key: 'trusted', label: 'Pessoa de confiança', placeholder: 'Nome e telefone' },
];

function ContactsEditor() {
  const contacts = useData((d) => d.profile?.contacts ?? {});
  const setProfile = useApp((s) => s.setProfile);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Contacts>(contacts);

  if (editing) {
    return (
      <form
        className="flex max-w-[32rem] flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          const clean = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v?.trim() || undefined])) as Contacts;
          setProfile({ contacts: clean });
          setEditing(false);
          toast('Contatos salvos.');
        }}
      >
        {CONTACT_FIELDS.map((f) => (
          <TextField
            key={f.key}
            label={f.label}
            placeholder={f.placeholder}
            value={draft[f.key] ?? ''}
            onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
          />
        ))}
        <div className="flex gap-2">
          <Button type="submit" variant="ink">
            Salvar contatos
          </Button>
          <Button variant="quiet" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col">
      <dl className="flex flex-col">
        {CONTACT_FIELDS.map((f) => {
          const v = contacts[f.key];
          const tel = v ? telOf(v) : null;
          return (
            <div key={f.key} className="flex min-h-14 items-center justify-between gap-4 border-b border-rule py-2.5">
              <div className="flex min-w-0 flex-col">
                <dt className="t-label">{f.label}</dt>
                <dd className={cn('truncate', v ? 'text-ink' : 'text-ink-3')}>{v || 'Não informado'}</dd>
              </div>
              {tel && (
                <a href={`tel:${tel}`} className="inline-flex h-11 shrink-0 items-center rounded-[3px] border border-ink/80 px-4 text-[0.9375rem] font-[620] t-cond text-ink hover:bg-paper-3">
                  Ligar
                </a>
              )}
            </div>
          );
        })}
      </dl>
      <div className="pt-3">
        <Button
          variant="quiet"
          className="-ml-3"
          onClick={() => {
            setDraft(contacts);
            setEditing(true);
          }}
        >
          Editar contatos
        </Button>
      </div>
    </div>
  );
}

function Screenings({ onStart }: { onStart: (i: Instrument) => void }) {
  const list = useData((d) => d.screenings);
  const history = useMemo(
    () => list.filter((s): s is Screening & { instrument: Instrument } => s.instrument in INSTRUMENTS).sort((a, b) => b.at.localeCompare(a.at)),
    [list],
  );

  return (
    <>
      <p className="max-w-[40rem] text-ink-2">
        Questionários curtos, usados em consultórios do mundo todo. Uma vez por mês basta. É triagem, não diagnóstico: o resultado serve para conversar com um profissional.
      </p>
      <div className="flex flex-col border-t border-ink">
        {(Object.keys(INSTRUMENTS) as Instrument[]).map((k) => {
          const inst = INSTRUMENTS[k];
          const last = lastScreening(list, k);
          const due = nextScreeningDue(list, k);
          const isDue = isScreeningDue(list, k);
          return (
            <div key={k} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-rule py-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-baseline gap-3">
                  <span className="t-title text-xl text-ink">{inst.name}</span>
                  <span className="text-ink-2">{inst.about}</span>
                </span>
                <span className="t-num text-sm text-ink-3">
                  {last ? `Última em ${fmtDate(last.at)}: ${bandLabel(k, last.score).toLowerCase()}. ` : 'Ainda não respondido. '}
                  {isDue ? (last ? 'A próxima já pode ser feita.' : '') : `Próxima a partir de ${fmtDate(due!)}.`}
                </span>
              </div>
              <Button variant={isDue ? 'ink' : 'secondary'} onClick={() => onStart(k)}>
                Responder {inst.name} ({inst.items.length} perguntas)
              </Button>
            </div>
          );
        })}
      </div>

      {history.length > 0 && (
        <div className="mt-4">
          <h3 className="t-label mb-1 text-ink">Histórico</h3>
          <table className="w-full text-left">
            <thead className="sr-only">
              <tr>
                <th>Data</th>
                <th>Instrumento</th>
                <th>Pontuação</th>
                <th>Faixa</th>
              </tr>
            </thead>
            <tbody>
              {history.map((s) => (
                <tr key={s.id} className="border-b border-rule">
                  <td className="t-num py-2.5 pr-4 text-ink-2">{fmtDate(s.at, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td className="py-2.5 pr-4 font-[600] text-ink">{INSTRUMENTS[s.instrument].name}</td>
                  <td className="t-num py-2.5 pr-4 text-ink">
                    {s.score}
                    <span className="text-ink-3">/{INSTRUMENTS[s.instrument].max}</span>
                  </td>
                  <td className="py-2.5 text-ink-2">{bandLabel(s.instrument, s.score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function WhenToSeek() {
  const health = useData((d) => d.health);
  const short = useMemo(() => {
    const from = dayKey(addDays(new Date(), -13));
    const nights = health.filter((h) => h.date >= from).map((h) => sleepHours(h.bedtime, h.wake)).filter((x): x is number => x != null);
    return { total: nights.length, short: nights.filter((h) => h < 6).length };
  }, [health]);

  const items = [
    'O PHQ-9 deu 15 ou mais, ou a pergunta sobre se ferir teve qualquer resposta diferente de “Nenhuma vez”. Neste caso, procure ajuda logo.',
    'O GAD-7 deu 15 ou mais.',
    'Por 4 semanas seguidas, as fugas fizeram você perder provas ou prazos, mesmo usando o app.',
    'Há meses você sente que perdeu o controle: a fuga ganha cada vez mais espaço e continua apesar do prejuízo.',
    'Você dorme menos de 6 horas na maioria das noites há 2 semanas.',
    'Você usa alguma substância para conseguir focar ou relaxar.',
    'Parece que a medicação perdeu o efeito.',
  ];

  return (
    <>
      <ul className="flex flex-col border-t border-ink">
        {items.map((t) => (
          <li key={t} className="flex gap-3 border-b border-rule py-3 text-ink">
            <MarkRescue size={18} className="mt-1 shrink-0 text-ink-3" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
      {short.total >= 7 && short.short > short.total / 2 && (
        <p className="border-y border-rule bg-light-soft px-4 py-3 text-ink">
          Nos seus registros das últimas 2 semanas, {short.short} de {short.total} noites tiveram menos de 6 horas de sono. Vale comentar com o psiquiatra.
        </p>
      )}
      <p className="max-w-[44rem] text-ink-2">
        Quem procurar: psicólogo que trabalhe com TCC ou ACT (o serviço-escola de psicologia da universidade costuma atender), uma revisão com o seu psiquiatra e, para o comportamento sexual, um profissional sem viés moralizante.
      </p>
    </>
  );
}

function Support({ onContinue }: { onContinue: () => void }) {
  return (
    <Page className="max-w-[44rem]">
      <div className="mb-6 text-magenta">
        <MarkRescue size={44} />
      </div>
      <h1 className="t-display text-[clamp(2rem,5vw,2.75rem)] text-ink">Você não precisa atravessar isso sozinho.</h1>
      <p className="mt-4 text-[1.0625rem] leading-relaxed text-ink-2">
        Você contou que tem pensado em se ferir ou que seria melhor estar morto. Obrigado por responder com sinceridade. Esse pensamento merece ser conversado com alguém, hoje.
      </p>
      <div className="mt-8">
        <CallLinks trusted />
      </div>
      <p className="mt-6 border-t border-rule pt-4 text-ink-2">
        O CVV atende 24 horas, de graça e sem julgamento. Se você estiver em perigo agora, ligue 192 ou vá ao pronto-socorro mais próximo. Conte também ao seu psiquiatra na próxima conversa.
      </p>
      <div className="mt-8">
        <Button variant="quiet" className="-ml-3" onClick={onContinue}>
          Ver o resultado da triagem
        </Button>
      </div>
    </Page>
  );
}

function Result({ screening, onDone }: { screening: Screening; onDone: () => void }) {
  const instrument = screening.instrument as Instrument;
  const inst = INSTRUMENTS[instrument];
  const a = alerts(instrument, screening.answers ?? []);
  return (
    <Page className="max-w-[44rem]">
      <p className="t-label">{inst.name} · {fmtDate(screening.at, { day: '2-digit', month: 'long' })}</p>
      <div className="mt-3 flex items-baseline gap-3 border-b border-ink pb-5">
        <span className="t-display t-num text-[4.5rem] leading-none text-ink">{screening.score}</span>
        <span className="t-num text-xl text-ink-3">/{inst.max}</span>
        <span className="t-title ml-auto text-xl text-ink">{bandLabel(instrument, screening.score)}</span>
      </div>
      <p className="mt-5 text-[1.0625rem] leading-relaxed text-ink-2">
        É uma fotografia das últimas 2 semanas, não um diagnóstico. Ela ganha sentido quando comparada com os próximos meses e conversada com um profissional.
      </p>
      {a.seekProfessional && (
        <div className="mt-6 border-y border-rule py-5">
          <h2 className="t-title text-xl text-ink">Vale procurar um profissional.</h2>
          <p className="mt-2 text-ink-2">
            Uma pontuação nessa faixa costuma pedir acompanhamento. Marque com o serviço de psicologia da universidade ou com o seu psiquiatra e leve o relatório do Rumo, se quiser.
          </p>
          <Link to="/ajuda#contatos" onClick={onDone} className="mt-3 inline-flex min-h-11 items-center font-[620] text-ink underline">
            Ver seus contatos
          </Link>
        </div>
      )}
      {a.urgent && (
        <p className="mt-6 text-ink-2">
          Lembrete: o CVV atende pelo{' '}
          <a href={`tel:${HELP.cvv.number}`} className="t-num font-[650] text-ink underline">
            188
          </a>{' '}
          a qualquer hora.
        </p>
      )}
      <div className="mt-10">
        <Button variant="ink" size="lg" onClick={onDone}>
          Voltar para Ajuda
        </Button>
      </div>
    </Page>
  );
}

const PRINT_CSS = `
@media print {
  @page { margin: 16mm; }
  body * { visibility: hidden !important; }
  #relatorio-30d, #relatorio-30d * { visibility: visible !important; color: black !important; background: white !important; border-color: silver !important; }
  #relatorio-30d { position: absolute; inset: 0 auto auto 0; width: 100%; padding: 0 !important; }
  #relatorio-30d .no-print { display: none !important; }
}`;

function reportOf(data: AppData, discreet: boolean, now = new Date()) {
  const from = addDays(now, -29);
  const fromKey = dayKey(from);
  const inRange = (at: string) => dayKey(at) >= fromKey;
  const series = focusSeries(data, 30, now);
  const sessions = data.focusSessions.filter((s) => inRange(s.start));
  const blocks = series.reduce((a, d) => ({ ...a, completed: a.completed + blocksOn(data, d.date).completed }), { completed: 0 });
  const urges = urgeStats(data, 30, now);

  const lapsesByType = ESCAPE_ORDER.map((t) => ({
    label: escapeLabel(t, discreet),
    n:
      data.lapses.filter((l) => l.type === t && inRange(l.at)).length +
      data.urges.filter((u) => u.type === t && u.outcome === 'lapsed' && inRange(u.at)).length,
  })).filter((x) => x.n > 0);

  const fromHealth = data.health
    .filter((h) => h.date >= fromKey)
    .map((h) => sleepHours(h.bedtime, h.wake))
    .filter((x): x is number => x != null);
  const fromCheckins = data.checkins.filter((c) => inRange(c.at) && c.sleepHours != null).map((c) => c.sleepHours!);
  const nights = fromHealth.length ? fromHealth : fromCheckins;
  const avgSleep = nights.length ? Math.round((nights.reduce((a, b) => a + b, 0) / nights.length) * 10) / 10 : null;

  const screenings = data.screenings
    .filter((s): s is Screening & { instrument: Instrument } => s.instrument in INSTRUMENTS && inRange(s.at))
    .sort((a, b) => a.at.localeCompare(b.at));

  return {
    from,
    totalMin: series.reduce((a, d) => a + d.minutes, 0),
    daysWithFocus: series.filter((d) => d.minutes > 0).length,
    avg7: focusMovingAvg7(data, now),
    started: sessions.length,
    completed: blocks.completed,
    urges,
    lapsesByType,
    avgSleep,
    nights: nights.length,
    shortNights: nights.filter((h) => h < 6).length,
    screenings,
  };
}

function Report({ onBack }: { onBack: () => void }) {
  const data = useData((d) => d);
  const discreet = data.settings.discreet;
  const now = useMemo(() => new Date(), []);
  const r = useMemo(() => reportOf(data, discreet, now), [data, discreet, now]);
  const lapsesTotal = r.lapsesByType.reduce((a, x) => a + x.n, 0);

  return (
    <Page className="max-w-[52rem]">
      <style>{PRINT_CSS}</style>
      <div id="relatorio-30d">
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
          <Button variant="quiet" className="-ml-3" onClick={onBack}>
            Voltar para Ajuda
          </Button>
          <Button variant="ink" onClick={() => window.print()}>
            Imprimir ou salvar PDF
          </Button>
        </div>

        <header className="border-b-2 border-ink pb-4">
          <h1 className="t-display text-[clamp(1.75rem,4vw,2.5rem)] text-ink">Relatório de 30 dias</h1>
          <p className="t-num mt-1 text-ink-2">
            {fmtDate(r.from, { day: '2-digit', month: '2-digit', year: 'numeric' })} a {fmtDate(now, { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </p>
        </header>

        <ReportBlock title="Foco">
          <ReportRow term="Minutos de foco no período" value={`${r.totalMin} min`} />
          <ReportRow term="Dias com algum bloco" value={`${r.daysWithFocus} de 30`} />
          <ReportRow term="Blocos iniciados / concluídos" value={`${r.started} / ${r.completed}`} />
          <ReportRow term="Média dos últimos 7 dias" value={`${r.avg7} min por dia`} />
        </ReportBlock>

        <ReportBlock title="Impulsos (SOS)">
          <ReportRow term="Vezes que usou o SOS" value={String(r.urges.total)} />
          <ReportRow term="Atravessados sem obedecer" value={r.urges.resistedPct == null ? 'sem registros' : `${r.urges.resisted} (${r.urges.resistedPct}%)`} />
          <ReportRow term="Queda média de intensidade" value={r.urges.avgDrop == null ? 'sem registros' : `${String(r.urges.avgDrop).replace('.', ',')} pontos (0–10)`} />
        </ReportBlock>

        <ReportBlock title="Lapsos por tipo">
          {r.lapsesByType.length ? (
            <>
              {r.lapsesByType.map((x) => (
                <ReportRow key={x.label} term={x.label} value={String(x.n)} />
              ))}
              <ReportRow term="Total" value={String(lapsesTotal)} />
            </>
          ) : (
            <ReportRow term="Registros" value="nenhum lapso registrado" />
          )}
        </ReportBlock>

        <ReportBlock title="Sono">
          <ReportRow term="Média por noite" value={r.avgSleep == null ? 'sem registros' : `${String(r.avgSleep).replace('.', ',')} h (${r.nights} noites)`} />
          <ReportRow term="Noites com menos de 6 h" value={r.nights ? String(r.shortNights) : 'sem registros'} />
        </ReportBlock>

        <ReportBlock title="Triagens">
          {r.screenings.length ? (
            r.screenings.map((s) => (
              <ReportRow
                key={s.id}
                term={`${INSTRUMENTS[s.instrument].name}, ${fmtDate(s.at, { day: '2-digit', month: '2-digit' })}`}
                value={`${s.score}/${INSTRUMENTS[s.instrument].max} · ${bandLabel(s.instrument, s.score)}${s.instrument === 'PHQ9' && (s.item9 ?? 0) > 0 ? ' · item 9 > 0' : ''}`}
              />
            ))
          ) : (
            <ReportRow term="Registros" value="nenhuma triagem no período" />
          )}
        </ReportBlock>

        <p className="mt-8 text-sm text-ink-3">
          Gerado pelo Rumo em {fmtDate(now, { day: '2-digit', month: '2-digit', year: 'numeric' })}. Dados autorregistrados no aparelho do paciente; PHQ-9 e GAD-7 são instrumentos de triagem, não de diagnóstico.
        </p>
      </div>
    </Page>
  );
}

function ReportBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="t-label border-b border-ink pb-1.5 text-ink">{title}</h2>
      <dl>{children}</dl>
    </section>
  );
}

function ReportRow({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-rule py-2">
      <dt className="text-ink-2">{term}</dt>
      <dd className="t-num text-right font-[600] text-ink">{value}</dd>
    </div>
  );
}
