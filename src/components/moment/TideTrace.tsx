import { useEffect, useRef } from 'react';
import useMeasure from 'react-use-measure';
import { clamp, cn } from '@/lib/utils';

/*
 * Modelo da onda: a vontade é a maré (sobe, chega ao pico, desce);
 * a respiração é a ondulação curta por cima dela (inspirar 4 s, expirar 6 s).
 */
export const PEAK_AT = 0.42;
const K = Math.log(0.5) / Math.log(PEAK_AT);
const BREATH_IN = 4;
const BREATH_CYCLE = 10;

function bell(x: number) {
  return Math.sin(Math.PI * Math.pow(clamp(x, 0, 1), K)) ** 2;
}

export function urgeLevel(t: number, baseSec: number, intensity: number) {
  if (t >= baseSec) return 0.12;
  const x = t / baseSec;
  const amp = 0.5 + 0.38 * (clamp(intensity, 0, 10) / 10);
  const floor = 0.26 - 0.14 * x;
  return floor + (amp - floor) * bell(x);
}

/** 0 → 1 ao inspirar, 1 → 0 ao expirar. */
export function breathAt(t: number): { phase: 'in' | 'out'; value: number; left: number } {
  const c = ((t % BREATH_CYCLE) + BREATH_CYCLE) % BREATH_CYCLE;
  if (c < BREATH_IN) return { phase: 'in', value: (1 - Math.cos((Math.PI * c) / BREATH_IN)) / 2, left: Math.ceil(BREATH_IN - c) };
  const e = c - BREATH_IN;
  const out = BREATH_CYCLE - BREATH_IN;
  return { phase: 'out', value: (1 + Math.cos((Math.PI * e) / out)) / 2, left: Math.ceil(out - e) };
}

function traceAt(t: number, baseSec: number, intensity: number) {
  const x = t / baseSec;
  const chopAmp = t < baseSec ? 0.007 + 0.016 * bell(x) : 0.005;
  const chop = chopAmp * (Math.sin((2 * Math.PI * t) / 3.1) + 0.6 * Math.sin((2 * Math.PI * t) / 7.3 + 1.3));
  return urgeLevel(t, baseSec, intensity) + chop + 0.045 * (breathAt(t).value - 0.5);
}

const SAMPLES = 520;

/**
 * Traço de marégrafo desenhado ao vivo. O caminho é atualizado por
 * requestAnimationFrame direto no DOM; anotações vêm de `elapsedSec` (grosso).
 */
export function TideTrace({
  startedAt,
  baseSec,
  totalSec,
  intensity,
  elapsedSec,
  className,
}: {
  startedAt: number;
  baseSec: number;
  totalSec: number;
  intensity: number;
  elapsedSec: number;
  className?: string;
}) {
  const [box, bounds] = useMeasure();
  const line = useRef<SVGPathElement>(null);
  const area = useRef<SVGPathElement>(null);
  const pen = useRef<SVGCircleElement>(null);
  const arm = useRef<SVGLineElement>(null);

  const W = Math.round(bounds.width);
  const H = Math.round(bounds.height);
  const top = 18;
  const bottom = Math.max(top + 40, H - 30);
  const xOf = (t: number) => (t / totalSec) * W;
  const yOf = (v: number) => bottom - clamp(v, 0, 1) * (bottom - top);

  useEffect(() => {
    if (!W || !H) return;
    let raf = 0;
    const dt = totalSec / SAMPLES;
    const frame = () => {
      const t = clamp((Date.now() - startedAt) / 1000, 0, totalSec);
      const k = Math.floor(t / dt);
      let d = '';
      for (let i = 0; i <= k; i++) {
        const tt = i * dt;
        d += `${i ? 'L' : 'M'}${xOf(tt).toFixed(1)},${yOf(traceAt(tt, baseSec, intensity)).toFixed(1)}`;
      }
      const px = xOf(t);
      const py = yOf(traceAt(t, baseSec, intensity));
      d += `L${px.toFixed(1)},${py.toFixed(1)}`;
      line.current?.setAttribute('d', d);
      area.current?.setAttribute('d', `${d}L${px.toFixed(1)},${bottom}L0,${bottom}Z`);
      pen.current?.setAttribute('cx', px.toFixed(1));
      pen.current?.setAttribute('cy', py.toFixed(1));
      arm.current?.setAttribute('x1', px.toFixed(1));
      arm.current?.setAttribute('y1', py.toFixed(1));
      arm.current?.setAttribute('y2', py.toFixed(1));
      if (t < totalSec) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [W, H, startedAt, totalSec, baseSec, intensity]);

  const halfMinutes = Math.floor(totalSec / 30);
  const peakT = PEAK_AT * baseSec;
  const showPeak = elapsedSec > peakT + 4;

  return (
    <div ref={box} className={cn('relative h-[clamp(13rem,50vw,21rem)] w-full', className)}>
      {W > 0 && H > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 overflow-visible" role="img" aria-label="Traçado da vontade ao longo do tempo">
          {/* papel do marégrafo */}
          <g className="text-rule" stroke="currentColor" strokeWidth={1}>
            {[0.25, 0.5, 0.75, 1].map((v) => (
              <line key={v} x1={0} x2={W} y1={yOf(v)} y2={yOf(v)} strokeDasharray={v === 1 ? undefined : '2 5'} />
            ))}
            {Array.from({ length: halfMinutes + 1 }, (_, i) => (
              <line
                key={i}
                x1={xOf(i * 30)}
                x2={xOf(i * 30)}
                y1={top}
                y2={bottom}
                className={i % 2 === 0 ? 'text-rule-2' : 'text-rule'}
                stroke="currentColor"
              />
            ))}
          </g>
          <line x1={0} x2={W} y1={bottom} y2={bottom} className="text-ink-3" stroke="currentColor" strokeWidth={1} />
          {Array.from({ length: Math.floor(totalSec / 60) + 1 }, (_, i) => {
            const x = xOf(i * 60);
            const last = i * 60 >= totalSec - 1;
            return (
              <text
                key={i}
                x={x}
                y={bottom + 19}
                textAnchor={i === 0 ? 'start' : last ? 'end' : 'middle'}
                className="t-label t-num fill-ink-3"
                style={{ fontSize: 11 }}
              >
                {i === 0 ? '0' : last ? `${i} min` : i}
              </text>
            );
          })}

          {totalSec > baseSec && (
            <g className="text-ink-3">
              <line x1={xOf(baseSec)} x2={xOf(baseSec)} y1={top} y2={bottom} stroke="currentColor" strokeDasharray="1 4" />
              <text x={xOf(baseSec) + 6} y={top + 12} className="t-label fill-ink-3" style={{ fontSize: 11 }}>
                respiração
              </text>
            </g>
          )}

          <path ref={area} className="fill-shoal" opacity={0.75} />
          <path ref={line} fill="none" className="stroke-ink" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />

          {showPeak && (
            <g className="text-ink-2">
              <line
                x1={xOf(peakT)}
                x2={xOf(peakT)}
                y1={yOf(urgeLevel(peakT, baseSec, intensity)) - 16}
                y2={yOf(urgeLevel(peakT, baseSec, intensity)) - 7}
                stroke="currentColor"
              />
              <text
                x={xOf(peakT)}
                y={yOf(urgeLevel(peakT, baseSec, intensity)) - 21}
                textAnchor="middle"
                className="t-label fill-ink-2"
                style={{ fontSize: 11 }}
              >
                pico
              </text>
            </g>
          )}

          {/* agulha: o único magenta */}
          <line ref={arm} x2={W} className="stroke-magenta" strokeWidth={1.25} />
          <circle ref={pen} r={4.5} className="fill-magenta" />
        </svg>
      )}
    </div>
  );
}
