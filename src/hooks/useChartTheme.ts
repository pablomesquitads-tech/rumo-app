import { useEffect, useState } from 'react';
import { useApp } from '@/store/app';
import { isNightHour } from '@/lib/utils';

/** Aplica a paleta Dia/Noite (ECDIS) no <html>. "auto" segue o horário. */
export function useChartTheme() {
  const pref = useApp((s) => s.data.settings.theme);
  const reduced = useApp((s) => s.data.settings.reducedMotion);
  const [hourNight, setHourNight] = useState(isNightHour());

  useEffect(() => {
    const t = setInterval(() => setHourNight(isNightHour()), 60_000);
    return () => clearInterval(t);
  }, []);

  const mode = pref === 'auto' ? (hourNight ? 'night' : 'day') : pref;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.chart = mode;
    root.dataset.motion = reduced ? 'reduced' : 'full';
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', mode === 'night' ? '#0b1117' : '#fbfcfc');
  }, [mode, reduced]);

  return mode;
}

/** Relógio que atualiza a cada `ms`. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
