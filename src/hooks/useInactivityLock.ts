import { useEffect, useState } from 'react';
import { useApp } from '@/store/app';
import { hasPin } from '@/lib/storage';

/** Tranca o cofre após N minutos sem interação (só quando há PIN). */
export function useInactivityLock() {
  const status = useApp((s) => s.status);
  const minutes = useApp((s) => s.data.settings.lockAfterMin);
  const touch = useApp((s) => s.touch);
  const lock = useApp((s) => s.lock);
  const [pin, setPin] = useState(false);

  useEffect(() => {
    if (status === 'ready') void hasPin().then(setPin);
  }, [status, minutes]);

  useEffect(() => {
    if (status !== 'ready' || !pin || !minutes) return;
    const onAct = () => touch();
    const evs = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    evs.forEach((e) => window.addEventListener(e, onAct, { passive: true }));
    const t = setInterval(() => {
      if (Date.now() - useApp.getState().lastActivity > minutes * 60_000) lock();
    }, 15_000);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, onAct));
      clearInterval(t);
    };
  }, [status, pin, minutes, touch, lock]);
}
