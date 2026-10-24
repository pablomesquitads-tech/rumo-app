import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { cn, fmtLongDate } from '@/lib/utils';
import { useApp } from '@/store/app';
import { useNow } from '@/hooks/useChartTheme';
import { CompassRose, MarkGrid, MarkWave } from '@/components/marks/Marks';
import { NAV } from './nav';

export function AppShell() {
  const now = useNow();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => setMoreOpen(false), [pathname]);

  return (
    <div className="min-h-dvh bg-paper text-ink lg:grid lg:grid-cols-[16.5rem_1fr]">
      {/* Trilho (notebook) */}
      <aside className="sticky top-0 hidden h-dvh lg:flex">
        <div className="flex min-w-0 flex-1 flex-col bg-paper-2">
          <Link to="/" className="flex items-center gap-3 px-6 pb-6 pt-7 text-ink">
            <CompassRose size={34} className="text-magenta" />
            <span className="t-display text-[1.75rem] leading-none">Rumo</span>
          </Link>
          <p className="t-label border-y border-rule px-6 py-2.5 first-letter:uppercase">{fmtLongDate(now)}</p>
          <nav aria-label="Principal" className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="flex flex-col gap-0.5">
              {NAV.map((item) => (
                <li key={item.to}>
                  <RailLink {...item} />
                </li>
              ))}
            </ul>
          </nav>
          <div className="border-t border-rule p-4">
            <SosButton variant="rail" />
          </div>
        </div>
        <div className="neatline-y" aria-hidden />
      </aside>

      {/* Coluna principal */}
      <div className="relative min-w-0">
        <header className="safe-t sticky top-0 z-30 border-b border-rule bg-paper/92 backdrop-blur-md lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Link to="/" className="flex items-center gap-2.5 text-ink">
              <CompassRose size={26} className="text-magenta" />
              <span className="t-display text-[1.375rem] leading-none">Rumo</span>
            </Link>
            <span className="t-label first-letter:uppercase">{fmtLongDate(now).split(',')[0]}</span>
          </div>
        </header>
        <main id="conteudo" className="min-h-dvh">
          <Outlet />
        </main>
      </div>

      {/* Barra inferior (celular) */}
      <nav
        aria-label="Principal"
        className="safe-b fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-paper/95 backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto grid h-16 max-w-[32rem] grid-cols-5 items-stretch">
          {NAV.filter((n) => n.primary)
            .slice(0, 2)
            .map((item) => (
              <li key={item.to}>
                <TabLink {...item} />
              </li>
            ))}
          <li className="relative flex items-start justify-center">
            <SosButton variant="tab" />
          </li>
          {NAV.filter((n) => n.primary)
            .slice(2)
            .map((item) => (
              <li key={item.to}>
                <TabLink {...item} />
              </li>
            ))}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              className={cn('flex h-full w-full flex-col items-center justify-center gap-1 text-ink-2', moreOpen && 'text-ink')}
            >
              <MarkGrid size={20} />
              <span className="text-[0.6875rem] font-[600] t-cond">Mais</span>
            </button>
          </li>
        </ul>
      </nav>

      <AnimatePresence>{moreOpen && <MoreSheet onClose={() => setMoreOpen(false)} />}</AnimatePresence>
    </div>
  );
}

function RailLink({ to, label, mark: Mark }: (typeof NAV)[number]) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'group relative flex h-11 items-center gap-3 rounded-[3px] px-3 text-[0.9375rem] transition-colors',
          isActive ? 'bg-paper text-ink font-[620] shadow-[inset_0_0_0_1px_var(--rule)]' : 'text-ink-2 hover:bg-paper-3 hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Mark size={20} className={cn('shrink-0 transition-colors', isActive ? 'text-magenta' : 'text-ink-3 group-hover:text-ink-2')} />
          {label}
        </>
      )}
    </NavLink>
  );
}

function TabLink({ to, label, mark: Mark }: (typeof NAV)[number]) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn('flex h-full flex-col items-center justify-center gap-1 transition-colors', isActive ? 'text-ink' : 'text-ink-3')
      }
    >
      {({ isActive }) => (
        <>
          <Mark size={20} className={isActive ? 'text-magenta' : undefined} />
          <span className={cn('text-[0.6875rem] t-cond', isActive ? 'font-[680]' : 'font-[560]')}>{label}</span>
        </>
      )}
    </NavLink>
  );
}

/** SOS: sempre a um toque. Magenta de carta, o único acento forte do app. */
export function SosButton({ variant }: { variant: 'rail' | 'tab' }) {
  const nav = useNavigate();
  const discreet = useApp((s) => s.data.settings.discreet);
  if (variant === 'tab') {
    return (
      <button
        type="button"
        onClick={() => nav('/sos')}
        aria-label="SOS: estou com um impulso"
        className="-mt-5 grid size-[3.75rem] place-items-center rounded-full bg-magenta text-magenta-ink shadow-[0_8px_20px_-8px_color-mix(in_oklab,var(--magenta)_70%,transparent)] ring-4 ring-paper transition-transform active:scale-95"
      >
        <span className="flex flex-col items-center leading-none">
          <MarkWave size={22} />
          <span className="mt-0.5 text-[0.625rem] font-[760] tracking-[0.12em] t-cond">SOS</span>
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => nav('/sos')}
      className="group flex w-full items-center gap-3 rounded-[3px] bg-magenta px-4 py-3.5 text-left text-magenta-ink transition-[filter] hover:brightness-110"
    >
      <MarkWave size={24} className="shrink-0 transition-transform duration-500 ease-out-expo group-hover:translate-x-0.5" />
      <span className="flex flex-col">
        <span className="text-[0.9375rem] font-[720] tracking-[0.06em] t-cond">SOS</span>
        <span className="text-[0.8125rem] opacity-90">{discreet ? 'Preciso de uma pausa' : 'Estou com um impulso'}</span>
      </span>
    </button>
  );
}

function MoreSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 lg:hidden">
      <motion.button
        aria-label="Fechar menu"
        className="absolute inset-0 bg-[var(--scrim)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-x-0 bottom-0 rounded-t-[8px] border-t border-rule bg-paper pb-[calc(5rem+env(safe-area-inset-bottom))] pt-2"
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-rule-2" aria-hidden />
        <ul className="grid grid-cols-2 px-3">
          {NAV.filter((n) => !n.primary).map(({ to, label, mark: Mark }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn('flex h-14 items-center gap-3 rounded-[3px] px-3 text-[0.9375rem]', isActive ? 'bg-paper-3 font-[620] text-ink' : 'text-ink-2')
                }
              >
                <Mark size={20} className="text-ink-3" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}
