import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Area, AreaChart, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import { useApp, useData } from '@/store/app';
import { Page, ScreenHeader, Section } from '@/components/ui/Screen';
import { Chip } from '@/components/ui/Check';
import { MarkLight } from '@/components/marks/Marks';
import { sleepHours } from '@/lib/metrics';
import type { HealthLog } from '@/lib/types';
import { addDays, cn, dayKey, fmtDate, fmtLongDate } from '@/lib/utils';

const EXERCISE_PRESETS = [10, 20, 30, 45];
const GOAL_MIN = 20;
const GOAL_DAYS = 3;
const ease = [0.16, 1, 0.3, 1] as const;

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
/** Hora de dormir como minutos contínuos a partir do meio-dia (00:30 vira 24:30). */
const bedAxis = (hhmm: string) => {
  const m = toMin(hhmm);
  return m < 12 * 60 ? m + 1440 : m;
};
const fmtAxis = (m: number) => {
  const x = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};
const minus60 = (hhmm: string) => fmtAxis(toMin(hhmm) - 60);
const hoursText = (h: number) => `${String(h).replace('.', ',')} h`;

function mondayOf(d: Date) {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  return addDays(x, -((x.getDay() + 6) % 7));
}

export default function Base() {
  const upsert = useApp((s) => s.upsert);
  const health = useData((d) => d.health);
  const target = useData((d) => d.profile?.bedtimeTarget ?? '23:30');
  const reduced = useData((d) => d.settings.reducedMotion);
  const today = dayKey();
  const log = health.find((h) => h.date === today);
  const update = (patch: Partial<HealthLog>) => upsert('health', { ...(log ?? { date: today }), ...patch });

  const hours = sleepHours(log?.bedtime, log?.wake);
  const [free, setFree] = useState('');

  const nights = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const d = addDays(new Date(), i - 13);
        const k = dayKey(d);
        const h = health.find((x) => x.date === k);
        return {
          date: k,
          label: fmtDate(d, { day: '2-digit' }),
          hours: sleepHours(h?.bedtime, h?.wake),
          bed: h?.bedtime ? bedAxis(h.bedtime) : null,
        };
      }),
    [health],
  );
  const recorded = nights.filter((n) => n.hours != null);
  const short = recorded.filter((n) => (n.hours ?? 0) < 6).length;
  const alert = recorded.length >= 7 && short * 2 > recorded.length;
  const avg = recorded.length ? Math.round((recorded.reduce((a, n) => a + (n.hours ?? 0), 0) / recorded.length) * 10) / 10 : null;

  const week = useMemo(() => {
    const mon = mondayOf(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(mon, i);
      const k = dayKey(d);
      return {
        date: k,
        wd: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').slice(0, 3),
        min: health.find((x) => x.date === k)?.exerciseMin ?? 0,
        isToday: k === today,
        future: k > today,
      };
    });
  }, [health, today]);
  const goalDays = week.filter((d) => d.min >= GOAL_MIN).length;

  const bedValues = nights.map((n) => n.bed).filter((x): x is number => x != null);
  const t = bedAxis(target);
  const bedDomain: [number, number] = [Math.min(t - 60, ...bedValues) - 30, Math.max(t + 60, ...bedValues) + 30];

  return (
    <Page>
      <ScreenHeader
        title="Sono e exercício"
        meta={fmtLongDate()}
        description="A base que sustenta atenção e controle. Registre em 20 segundos; o resto o app calcula."
      />

      <div className="grid gap-x-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col">
          <Section label="Sono de hoje" aside={hours != null ? undefined : 'Noite passada'}>
            <div className="grid grid-cols-2 gap-3">
              <TimeInput label="Fui dormir" value={log?.bedtime ?? ''} onChange={(v) => update({ bedtime: v })} />
              <TimeInput label="Acordei" value={log?.wake ?? ''} onChange={(v) => update({ wake: v })} />
            </div>
            <div className="flex items-baseline justify-between border-y border-rule py-3">
              <span className="t-label">Horas de sono</span>
              <motion.span
                key={hours ?? 'none'}
                initial={{ opacity: 0.4, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease }}
                className="t-num t-display text-[2.25rem] leading-none text-ink"
              >
                {hours != null ? hoursText(hours) : '–'}
              </motion.span>
            </div>
            <p className="text-sm text-ink-3">
              Alvo para dormir: <span className="t-num text-ink-2">{target}</span>. Telas de lazer desligadas às{' '}
              <span className="t-num text-ink-2">{minus60(target)}</span>.
            </p>
          </Section>

          <Section label="Exercício de hoje" aside={<span className="t-num">{log?.exerciseMin ? `${log.exerciseMin} min` : 'nenhum ainda'}</span>}>
            <div className="flex flex-wrap gap-2">
              {EXERCISE_PRESETS.map((m) => (
                <Chip key={m} selected={log?.exerciseMin === m} onClick={() => update({ exerciseMin: log?.exerciseMin === m ? 0 : m })} className="t-num min-h-11 px-4">
                  {m} min
                </Chip>
              ))}
            </div>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const n = Math.round(Number(free));
                if (n >= 0 && n <= 600) {
                  update({ exerciseMin: n });
                  setFree('');
                }
              }}
            >
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ex-free" className="t-label">
                  Outro valor (min)
                </label>
                <input
                  id="ex-free"
                  inputMode="numeric"
                  type="number"
                  min={0}
                  max={600}
                  value={free}
                  onChange={(e) => setFree(e.target.value)}
                  className="t-num h-12 w-28 rounded-[3px] border border-rule-2 bg-paper px-3.5 text-ink focus:border-ink focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={!free}
                className="t-cond h-12 rounded-[3px] border border-ink/80 px-4 text-[0.9375rem] font-[620] text-ink transition-colors hover:bg-paper-3 disabled:opacity-45"
              >
                Registrar
              </button>
            </form>
          </Section>

          <Section label="Meta da semana" aside={<span className="t-num">{goalDays} de {GOAL_DAYS} dias · 20–30 min</span>}>
            <ol className="grid grid-cols-7 border border-rule" aria-label="Exercício por dia da semana">
              {week.map((d) => {
                const met = d.min >= GOAL_MIN;
                const some = d.min > 0 && !met;
                return (
                  <li
                    key={d.date}
                    className={cn(
                      'flex min-h-16 flex-col items-center justify-center gap-1 border-l border-rule first:border-l-0',
                      met && 'bg-shoal-2',
                      some && 'bg-shoal',
                      d.future && 'text-ink-3',
                    )}
                    aria-label={`${d.wd}: ${d.min ? `${d.min} min` : 'sem registro'}`}
                  >
                    <span className={cn('t-label', d.isToday && 'text-ink underline decoration-magenta decoration-2 underline-offset-4')}>{d.wd}</span>
                    <span className="t-num text-sm text-ink">{d.min ? d.min : ''}</span>
                  </li>
                );
              })}
            </ol>
            <p className="text-sm text-ink-3">Dias com 20 min ou mais ficam preenchidos. A semana recomeça na segunda, sem contagem acumulada.</p>
          </Section>
        </div>

        <div className="flex min-w-0 flex-col">
          <Section label="Sono, últimas 14 noites" aside={avg != null ? <span className="t-num">média {hoursText(avg)}</span> : undefined}>
            {recorded.length === 0 ? (
              <p className="border-b border-rule pb-4 text-ink-3">Registre a hora de dormir e de acordar para ver a maré do sono.</p>
            ) : (
              <>
                <div className="h-52 w-full" role="img" aria-label={`Horas de sono: ${recorded.map((n) => `${n.label} ${n.hours}`).join(', ')}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={nights} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                      <ReferenceArea y1={7} y2={9} fill="var(--paper-3)" fillOpacity={1} ifOverflow="extendDomain" />
                      <XAxis dataKey="label" axisLine={{ stroke: 'var(--rule)' }} tickLine={false} tick={{ fill: 'var(--ink-3)', fontSize: 11 }} interval={1} />
                      <YAxis
                        domain={[3, 11]}
                        ticks={[3, 5, 7, 9, 11]}
                        axisLine={{ stroke: 'var(--rule)' }}
                        tickLine={false}
                        tick={{ fill: 'var(--ink-3)', fontSize: 11 }}
                        tickFormatter={(v: number) => `${v}h`}
                        width={44}
                      />
                      <ReferenceLine y={7} stroke="var(--rule-2)" strokeDasharray="3 3" />
                      <ReferenceLine y={9} stroke="var(--rule-2)" strokeDasharray="3 3" label={{ value: 'meta 7–9 h', position: 'insideTopRight', fill: 'var(--ink-2)', fontSize: 11 }} />
                      <Tooltip cursor={{ stroke: 'var(--rule-2)' }} content={<NightTip />} />
                      <Area
                        type="monotone"
                        dataKey="hours"
                        stroke="var(--shoal-3)"
                        strokeWidth={2}
                        fill="var(--shoal)"
                        fillOpacity={1}
                        connectNulls
                        dot={{ r: 2.5, fill: 'var(--shoal-3)', stroke: 'none' }}
                        activeDot={{ r: 4, fill: 'var(--sea)', stroke: 'var(--paper)' }}
                        baseValue={3}
                        isAnimationActive={!reduced}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-2 flex items-baseline justify-between">
                  <span className="t-label">Hora de dormir</span>
                  <span className="t-num text-sm text-ink-3">alvo {target}</span>
                </div>
                <div className="h-32 w-full" role="img" aria-label={`Horas de dormir em relação ao alvo de ${target}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={nights} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                      <XAxis dataKey="label" axisLine={{ stroke: 'var(--rule)' }} tickLine={false} tick={{ fill: 'var(--ink-3)', fontSize: 11 }} interval={1} />
                      <YAxis
                        domain={bedDomain}
                        reversed
                        axisLine={{ stroke: 'var(--rule)' }}
                        tickLine={false}
                        tick={{ fill: 'var(--ink-3)', fontSize: 11 }}
                        tickFormatter={fmtAxis}
                        tickCount={3}
                        width={44}
                      />
                      <ReferenceLine y={t} stroke="var(--sea)" strokeDasharray="4 3" />
                      <Tooltip cursor={{ stroke: 'var(--rule-2)' }} content={<BedTip />} />
                      <Line
                        type="monotone"
                        dataKey="bed"
                        stroke="var(--shoal-3)"
                        strokeWidth={1.5}
                        connectNulls
                        dot={{ r: 3, fill: 'var(--paper)', stroke: 'var(--shoal-3)', strokeWidth: 1.5 }}
                        isAnimationActive={!reduced}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-sm text-ink-3">Acima da linha tracejada: dormiu antes do alvo.</p>
              </>
            )}

            {alert && (
              <div className="flex items-start gap-3 border-y border-rule py-4">
                <MarkLight className="mt-0.5 shrink-0 text-light" />
                <p className="text-[0.9375rem] leading-relaxed text-ink">
                  Na maioria das noites registradas nas últimas duas semanas ({short} de {recorded.length}), o sono ficou abaixo de 6 h. Isso merece uma conversa com um
                  profissional de saúde.{' '}
                  <Link to="/ajuda" className="underline">
                    Ver Ajuda
                  </Link>
                </p>
              </div>
            )}
          </Section>

          <Section label="Por que isso importa">
            <p className="t-title text-lg text-ink">Antes do bloco mais difícil: 10 a 30 min de exercício aeróbico moderado.</p>
            <ul className="flex flex-col text-[0.9375rem] leading-relaxed text-ink-2">
              <li className="border-b border-rule py-2.5">
                A atividade física melhora o controle inibitório em adultos com TDAH. <span className="text-ink-3">Meta-análise, Journal of Global Health, 2025.</span>
              </li>
              <li className="border-b border-rule py-2.5">
                30 min de bicicleta melhoraram atenção e velocidade de processamento em adultos com TDAH. <span className="text-ink-3">Mehren et al., 2019.</span>
              </li>
              <li className="py-2.5">
                A privação de sono prejudica a atenção sustentada e as funções executivas. <span className="text-ink-3">Lim e Dinges, 2010, meta-análise.</span>
              </li>
            </ul>
          </Section>
        </div>
      </div>
    </Page>
  );
}

function TimeInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = `t-${label.replace(/\s/g, '-').toLowerCase()}`;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="t-label">
        {label}
      </label>
      <input
        id={id}
        type="time"
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="t-num t-title h-16 w-full min-w-0 rounded-[3px] border border-rule-2 bg-paper px-3 text-[1.75rem] text-ink transition-colors hover:border-ink-3 focus:border-ink focus:outline-none"
      />
    </div>
  );
}

function NightTip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as { date: string; hours: number | null };
  return (
    <div className="rounded-[3px] border border-rule bg-paper px-3 py-2 text-sm">
      <p className="t-label">{fmtDate(`${p.date}T12:00:00`, { weekday: 'short', day: '2-digit' })}</p>
      <p className="t-num text-ink">{p.hours != null ? hoursText(p.hours) : 'sem registro'}</p>
    </div>
  );
}

function BedTip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as { date: string; bed: number | null };
  return (
    <div className="rounded-[3px] border border-rule bg-paper px-3 py-2 text-sm">
      <p className="t-label">{fmtDate(`${p.date}T12:00:00`, { weekday: 'short', day: '2-digit' })}</p>
      <p className="t-num text-ink">{p.bed != null ? `dormiu ${fmtAxis(p.bed)}` : 'sem registro'}</p>
    </div>
  );
}
