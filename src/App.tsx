import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useApp } from '@/store/app';
import { useChartTheme } from '@/hooks/useChartTheme';
import { useInactivityLock } from '@/hooks/useInactivityLock';
import { AppShell } from '@/components/shell/AppShell';
import { Toaster } from '@/components/ui/toast';
import { CompassRose } from '@/components/marks/Marks';
import Today from '@/routes/Today';

const Onboarding = lazy(() => import('@/routes/Onboarding'));
const Lock = lazy(() => import('@/routes/Lock'));
const CheckIn = lazy(() => import('@/routes/CheckIn'));
const Focus = lazy(() => import('@/routes/Focus'));
const Sos = lazy(() => import('@/routes/Sos'));
const Lapse = lazy(() => import('@/routes/Lapse'));
const Problems = lazy(() => import('@/routes/Problems'));
const Review = lazy(() => import('@/routes/Review'));
const Progress = lazy(() => import('@/routes/Progress'));
const Base = lazy(() => import('@/routes/Base'));
const Help = lazy(() => import('@/routes/Help'));
const Settings = lazy(() => import('@/routes/Settings'));

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-paper text-magenta">
      <CompassRose size={56} ticks className="animate-[spin_14s_linear_infinite]" />
    </div>
  );
}

function RequireOnboarding({ children }: { children: ReactNode }) {
  const onboarded = useApp((s) => Boolean(s.data.profile?.onboardedAt));
  const { pathname } = useLocation();
  if (!onboarded && pathname !== '/inicio') return <Navigate to="/inicio" replace />;
  return <>{children}</>;
}

function Gate() {
  const status = useApp((s) => s.status);
  useChartTheme();
  useInactivityLock();

  if (status === 'booting') return <Splash />;
  if (status === 'locked')
    return (
      <Suspense fallback={<Splash />}>
        <Lock />
      </Suspense>
    );
  if (status === 'error')
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="max-w-sm">
          <p className="t-title text-xl">Não consegui abrir o armazenamento local.</p>
          <p className="mt-2 text-ink-2">
            Verifique se o navegador não está em modo privado com armazenamento bloqueado e recarregue a página.
          </p>
        </div>
      </div>
    );

  return (
    <Suspense fallback={<Splash />}>
      <RequireOnboarding>
        <Routes>
          <Route path="/inicio" element={<Onboarding />} />
          <Route path="/foco" element={<Focus />} />
          <Route path="/sos" element={<Sos />} />
          <Route element={<AppShell />}>
            <Route index element={<Today />} />
            <Route path="/checkin" element={<CheckIn />} />
            <Route path="/lapso" element={<Lapse />} />
            <Route path="/caixa" element={<Problems />} />
            <Route path="/revisao" element={<Review />} />
            <Route path="/progresso" element={<Progress />} />
            <Route path="/base" element={<Base />} />
            <Route path="/ajuda" element={<Help />} />
            <Route path="/ajustes" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </RequireOnboarding>
      <Toaster />
    </Suspense>
  );
}

export default function App() {
  const boot = useApp((s) => s.boot);
  useEffect(() => {
    void boot();
  }, [boot]);
  return (
    <BrowserRouter>
      <Gate />
    </BrowserRouter>
  );
}
