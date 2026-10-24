import type { ComponentType, SVGProps } from 'react';
import {
  MarkDial,
  MarkLight,
  MarkLog,
  MarkRescue,
  MarkRock,
  MarkSoundings,
  MarkTide,
  MarkTrack,
  MarkWaypoint,
} from '@/components/marks/Marks';

export interface NavItem {
  to: string;
  label: string;
  mark: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
  /** aparece na barra inferior do celular */
  primary?: boolean;
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Hoje', mark: MarkWaypoint, primary: true },
  { to: '/foco', label: 'Foco', mark: MarkLight, primary: true },
  { to: '/caixa', label: 'Problemas', mark: MarkRock, primary: true },
  { to: '/lapso', label: 'Lapso', mark: MarkTrack },
  { to: '/revisao', label: 'Revisão', mark: MarkLog },
  { to: '/progresso', label: 'Progresso', mark: MarkSoundings },
  { to: '/base', label: 'Sono e exercício', mark: MarkTide },
  { to: '/ajuda', label: 'Ajuda', mark: MarkRescue },
  { to: '/ajustes', label: 'Ajustes', mark: MarkDial },
];
