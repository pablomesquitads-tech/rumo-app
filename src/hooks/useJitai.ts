import { useEffect } from 'react';
import { useApp } from '@/store/app';
import { startJitai } from '@/lib/notifications';

/** Liga o motor de notificações locais enquanto o cofre está aberto e o usuário permitiu. */
export function useJitai() {
  const ready = useApp((s) => s.status === 'ready');
  const enabled = useApp((s) => s.data.settings.notificationsEnabled);
  const onboarded = useApp((s) => Boolean(s.data.profile?.onboardedAt));

  useEffect(() => {
    if (!ready || !enabled || !onboarded) return;
    return startJitai(
      () => useApp.getState().data,
      (n) => useApp.getState().upsert('notifications', n),
    );
  }, [ready, enabled, onboarded]);
}
