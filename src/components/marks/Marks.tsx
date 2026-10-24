import type { SVGProps } from 'react';

/**
 * Símbolos de carta náutica desenhados para o Rumo (um traço, 1.5px, grade de 20).
 * Não são ícones genéricos: cada um é a convenção cartográfica do conceito.
 */
type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: P) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden {...rest}>
      {children}
    </svg>
  );
}

/** Waypoint: círculo com ponto. */
export const MarkWaypoint = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="6" />
    <circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none" />
  </Svg>
);

/** Luz de farol: ponto e lampejo. */
export const MarkLight = (p: P) => (
  <Svg {...p}>
    <circle cx="6" cy="14" r="1.8" fill="currentColor" stroke="none" />
    <path d="M7.4 12.6c1.8-4.2 4.6-7 9.1-8.6-1.4 4.5-4.2 7.4-8.4 9.3" strokeLinejoin="round" />
  </Svg>
);

/** Ondas: o impulso como onda que sobe e baixa. */
export const MarkWave = (p: P) => (
  <Svg {...p}>
    <path d="M2 8.5c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2" strokeLinecap="round" />
    <path d="M2 13.5c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2" strokeLinecap="round" />
  </Svg>
);

/** Pedra submersa (rock awash): o problema debaixo da superfície. */
export const MarkRock = (p: P) => (
  <Svg {...p}>
    <path d="M10 4v12M4 10h12" />
    <circle cx="6.2" cy="6.2" r="1" fill="currentColor" stroke="none" />
    <circle cx="13.8" cy="6.2" r="1" fill="currentColor" stroke="none" />
    <circle cx="6.2" cy="13.8" r="1" fill="currentColor" stroke="none" />
    <circle cx="13.8" cy="13.8" r="1" fill="currentColor" stroke="none" />
  </Svg>
);

/** Derrota (track): tracejado com ponta. */
export const MarkTrack = (p: P) => (
  <Svg {...p}>
    <path d="M3 15.5 13.5 5" strokeDasharray="2.4 2.2" />
    <path d="M9 4.6h5v5" />
  </Svg>
);

/** Diário de bordo. */
export const MarkLog = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="3" width="12" height="14" rx="0.5" />
    <path d="M7 7h6M7 10h6M7 13h3.5" />
  </Svg>
);

/** Isóbatas: curvas de profundidade aninhadas. */
export const MarkSoundings = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 15c3-1 4.5-5 7.5-5s4.5 4 7.5 5" />
    <path d="M5.5 15c1.8-.6 2.7-2.6 4.5-2.6s2.7 2 4.5 2.6" />
    <path d="M2.5 6.5h3M8.5 5h3M14.5 6.5h3" />
  </Svg>
);

/** Maré e lua: sono e ritmo. */
export const MarkTide = (p: P) => (
  <Svg {...p}>
    <path d="M12.5 3.2a5.5 5.5 0 1 0 4.3 8.3 4.4 4.4 0 0 1-4.3-8.3Z" strokeLinejoin="round" />
    <path d="M2 16.5c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1" strokeLinecap="round" />
  </Svg>
);

/** Estação de salvamento: boia circular. */
export const MarkRescue = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="6.5" />
    <circle cx="10" cy="10" r="3" />
    <path d="M10 3.5V7M10 13v3.5M3.5 10H7M13 10h3.5" strokeWidth={2.4} />
  </Svg>
);

/** Círculo graduado: ajustes. */
export const MarkDial = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="6.5" />
    <path d="M10 2v2.2M10 15.8V18M2 10h2.2M15.8 10H18M4.3 4.3l1.5 1.5M14.2 14.2l1.5 1.5M15.7 4.3l-1.5 1.5M5.8 14.2l-1.5 1.5" />
    <path d="M10 10 12.6 7.4" strokeLinecap="round" />
  </Svg>
);

/** Retícula 2×2: mais. */
export const MarkGrid = (p: P) => (
  <Svg {...p}>
    <path d="M3 3h14v14H3zM10 3v14M3 10h14" />
  </Svg>
);

/** Âncora de mudança: seta curva para "voltar à tarefa". */
export const MarkReturn = (p: P) => (
  <Svg {...p}>
    <path d="M15 6.5H8a4 4 0 0 0 0 8h5" />
    <path d="m12 3.5 3 3-3 3" />
  </Svg>
);

/**
 * Rosa dos ventos com graduação, como as rosas magenta das cartas.
 * `ticks` desenha a graduação externa.
 */
export function CompassRose({ size = 28, ticks = false, className }: { size?: number; ticks?: boolean; className?: string }) {
  const marks = ticks ? Array.from({ length: 72 }, (_, i) => i * 5) : [];
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden>
      {ticks && (
        <g stroke="currentColor" strokeWidth={0.6}>
          <circle cx="50" cy="50" r="47" fill="none" />
          {marks.map((deg) => {
            const long = deg % 30 === 0;
            const r1 = 47;
            const r2 = long ? 41 : 44;
            const a = (deg * Math.PI) / 180;
            return (
              <line
                key={deg}
                x1={50 + r1 * Math.sin(a)}
                y1={50 - r1 * Math.cos(a)}
                x2={50 + r2 * Math.sin(a)}
                y2={50 - r2 * Math.cos(a)}
              />
            );
          })}
        </g>
      )}
      <g fill="currentColor">
        {/* pontas cardeais: metade cheia, metade vazada */}
        <path d="M50 8 56 44 50 50Z" />
        <path d="M50 8 44 44 50 50Z" fillOpacity={0.25} />
        <path d="M92 50 56 56 50 50Z" />
        <path d="M92 50 56 44 50 50Z" fillOpacity={0.25} />
        <path d="M50 92 44 56 50 50Z" />
        <path d="M50 92 56 56 50 50Z" fillOpacity={0.25} />
        <path d="M8 50 44 44 50 50Z" />
        <path d="M8 50 44 56 50 50Z" fillOpacity={0.25} />
        {/* colaterais */}
        <path d="M74 26 53 47 50 50Z" fillOpacity={0.55} />
        <path d="M74 74 53 53 50 50Z" fillOpacity={0.55} />
        <path d="M26 74 47 53 50 50Z" fillOpacity={0.55} />
        <path d="M26 26 47 47 50 50Z" fillOpacity={0.55} />
      </g>
      <circle cx="50" cy="50" r="2.4" fill="var(--paper)" stroke="currentColor" strokeWidth={1} />
    </svg>
  );
}
