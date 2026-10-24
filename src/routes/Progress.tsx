import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import { useData } from '@/store/app';
import { Empty, Page, Reading, ScreenHeader, Section } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { ESCAPE_ORDER, escapeLabel } from '@/lib/defaults';
import { HOUR_BANDS, daysWithinPlan, focusMovingAvg7, focusSeries, lapseHeatmap, plannedStartedRate, riskHours, urgeStats } from '@/lib/metrics';
import { cn, fmtDate } from '@/lib/utils';

const heat = (n: number) => (n === 0 ? 'bg-paper-2 text-ink-3' : n === 1 ? 'bg-shoal text-ink' : n === 2 ? 'bg-shoal-2 text-ink' : 'bg-shoal-3 text-ink');

export default function Progress() {
  const focusSessions = useData((d) => d.focusSessions);
  const dayPlans = useData((d) => d.dayPlans);
  const urges = useData((d) => d.urges);
  const lapses = useData((d) => d.lapses);
  const problems = useData((d) => d.problems);
  const discreet = useData((d) => d.settings.discreet);
  const reduced = useData((d) => d.settings.reducedMotion);

  const series = useMemo(() => focusSeries({ focusSessions }, 30).map((s) => ({ ...s, label: fmtDate(`${s.date}T12:00:00`, { day: '2-digit' }) })), [focusSessions]);
  const avg7 = useMemo(() => focusMovingAvg7({ focusSessions }), [focusSessions]);
  const total30 = series.reduce((a, s) => a + s.minutes, 0);
  const started = useMemo(() => plannedStartedRate({ dayPlans, focusSessions }), [dayPlans, focusSessions]);
  const urge = useMemo(() => urgeStats({ urges }), [urges]);
  const within = useMemo(() => daysWithinPlan({ focusSessions, lapses }), [focusSessions, lapses]);
  const grid = useMemo(() => lapseHeatmap({ lapses, urges }), [lapses, urges]);
  const risk = useMemo(() => riskHours({ lapses, urges }), [lapses, urges]);
  const [picked, setPicked] = useState<string | null>(null);
  const pickedMark = within.marks.find((m) => m.date === picked);
  const resolved = problems.filter((p) => p.status === 'resolved');
  const problemMin = problems.reduce((a, p) => a + (p.minutesSpent ?? 0), 0);

  const rows = ESCAPE_ORDER.filter((t) => grid.has(t));
  const hasAny = focusSessions.length + urges.length + lapses.length + problems.length > 0;

  return (
    <Page className="lg:max-w-[76rem]">
      <ScreenHeader title="Progresso" meta="últimos 30 dias" description="O que você fez, sem contador que zera. Dia sem registro fica em branco e não conta contra você." />

      {!hasAny ? (
        <div className="pt-8">
          <Empty
            title="Ainda não há o que mostrar."
            action={
              <Link to="/foco?min=12">
                <Button variant="ink" size="md">
                  Começar bloco de 12 min
                </Button>
              </Link>
            }
          >
            O primeiro bloco de foco, o primeiro impulso atravessado ou o primeiro lapso analisado já aparece aqui.
          </Empty>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-6 border-b border-rule py-6 lg:grid-cols-4">
            <Reading label="Foco por dia (7 dias)" value={avg7} unit="min" note={`${total30} min em 30 dias`} />
            <Reading label="Blocos iniciados" value={started == null ? '–' : started} unit={started == null ? undefined : '% do plano'} note="Últimos 7 dias" />
            <Reading
              label="Impulsos atravessados"
              value={urge.resisted}
              unit={`de ${urge.total}`}
              note={urge.avgDrop != null ? `Intensidade caiu ${String(urge.avgDrop).replace('.', ',')} pontos em média` : undefined}
            />
            <Reading label="Dias dentro do plano" value={within.pct == null ? '–' : within.pct} unit={within.pct == null ? undefined : '%'} note="Bloco feito e lapso analisado" />
          </dl>

          <div className="grid gap-x-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col">
              <Section label="Minutos de foco por dia" aside={<span className="t-num">{total30} min</span>}>
                <div className="h-56 w-full" role="img" aria-label={`Minutos de foco por dia nos últimos 30 dias: ${series.filter((s) => s.minutes > 0).map((s) => `${s.label} ${s.minutes}`).join(', ') || 'sem registros'}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={series} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
                      <XAxis dataKey="label" axisLine={{ stroke: 'var(--rule)' }} tickLine={false} tick={{ fill: 'var(--ink-3)', fontSize: 11 }} interval={4} />
                      <YAxis axisLine={{ stroke: 'var(--rule)' }} tickLine={false} tick={{ fill: 'var(--ink-3)', fontSize: 11 }} allowDecimals={false} width={40} />
                      <Tooltip cursor={{ fill: 'var(--paper-3)' }} content={<MinutesTip />} />
                      <Bar dataKey="minutes" fill="var(--sea)" radius={[2, 2, 0, 0]} maxBarSize={14} isAnimationActive={!reduced} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>

              <Section label="Dias dentro do plano" aside={<span className="t-num">{within.pct == null ? 'sem dados' : `${within.pct}%`}</span>}>
                <ol className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-px border border-rule bg-rule sm:grid-cols-[repeat(30,minmax(0,1fr))]" aria-label="Dias dentro do plano, do mais antigo ao mais recente">
                  {within.marks.map((m) => {
                    const state = m.within ? 'dentro do plano' : m.blocks > 0 || m.lapses > 0 ? 'com registro' : 'sem registro';
                    return (
                      <li key={m.date} className="bg-paper">
                        <button
                          type="button"
                          onClick={() => setPicked(picked === m.date ? null : m.date)}
                          aria-pressed={picked === m.date}
                          aria-label={`${fmtDate(`${m.date}T12:00:00`)}: ${state}`}
                          className={cn('block h-7 w-full', m.within ? 'bg-shoal-3' : m.blocks > 0 || m.lapses > 0 ? 'bg-shoal' : 'bg-paper', picked === m.date && 'outline outline-2 -outline-offset-2 outline-ink')}
                        />
                      </li>
                    );
                  })}
                </ol>
                <p className="t-num min-h-6 text-sm text-ink" aria-live="polite">
                  {pickedMark
                    ? `${fmtDate(`${pickedMark.date}T12:00:00`, { weekday: 'long', day: '2-digit', month: 'short' })}: ${pickedMark.blocks} ${pickedMark.blocks === 1 ? 'bloco' : 'blocos'}, ${pickedMark.lapses} ${pickedMark.lapses === 1 ? 'lapso' : 'lapsos'}`
                    : ''}
                </p>
                <p className="text-sm text-ink-3">Preenchido forte: bloco feito e nenhum lapso sem análise. Claro: dia com registro. Branco: sem registro.</p>
              </Section>
            </div>

            <div className="flex min-w-0 flex-col">
              <Section label="Quando os lapsos acontecem" aside="últimos 60 dias">
                {rows.length === 0 ? (
                  <p className="border-b border-rule pb-4 text-ink-3">Sem lapsos nos últimos 60 dias.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[28rem] border-collapse text-sm">
                      <caption className="sr-only">Lapsos por tipo e faixa de 3 horas</caption>
                      <thead>
                        <tr>
                          <th scope="col" className="t-label pb-2 text-left font-[600]">
                            Tipo
                          </th>
                          {HOUR_BANDS.map((b) => (
                            <th key={b} scope="col" className="t-label t-num pb-2 text-center font-[600]">
                              {b}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((t) => (
                          <tr key={t}>
                            <th scope="row" className="py-px pr-3 text-left font-[500] text-ink">
                              {escapeLabel(t, discreet)}
                            </th>
                            {(grid.get(t) ?? []).map((n, i) => (
                              <td key={i} className={cn('t-num h-9 border border-paper text-center', heat(n))}>
                                {n || ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {risk.length > 0 && (
                  <p className="border-y border-rule py-3 text-[0.9375rem] text-ink-2">
                    Janela de risco nas últimas 2 semanas: <span className="t-num text-ink">{risk.map((h) => `${String(h).padStart(2, '0')}h`).join(' e ')}</span>. Um se-então para esse horário pesa mais.
                  </p>
                )}
              </Section>

              <Section label="Caixa de problemas">
                <dl className="grid grid-cols-2 gap-4 border-b border-rule pb-4">
                  <Reading label="Resolvidos" value={resolved.length} />
                  <Reading label="Minutos dedicados" value={problemMin} unit="min" />
                </dl>
                <Link to="/caixa" className="inline-flex min-h-11 items-center self-start text-ink underline">
                  Abrir a Caixa
                </Link>
              </Section>
            </div>
          </div>
        </>
      )}
    </Page>
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
