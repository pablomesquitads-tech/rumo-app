import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App';
import './styles/index.css';

if (import.meta.env.DEV) {
  const demo = new URLSearchParams(location.search).get('demo');
  if (demo !== null) sessionStorage.setItem('rumo-demo', demo || '/');
}
if (import.meta.env.DEV) void import('./lib/devSeed').then((m) => m.installDevSeed());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);
