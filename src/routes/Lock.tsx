import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { useApp } from '@/store/app';
import { cn } from '@/lib/utils';
import { CompassRose } from '@/components/marks/Marks';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/Field';

const MAX = 8;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export default function Lock() {
  const unlock = useApp((s) => s.unlock);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [forgot, setForgot] = useState(false);

  const press = useCallback(
    (d: string) => {
      if (busy) return;
      setError(false);
      setPin((p) => (p.length < MAX ? p + d : p));
    },
    [busy],
  );
  const back = useCallback(() => {
    if (busy) return;
    setPin((p) => p.slice(0, -1));
  }, [busy]);

  const submit = useCallback(async () => {
    if (busy || pin.length < 4) return;
    setBusy(true);
    const ok = await unlock(pin);
    if (!ok) {
      setBusy(false);
      setError(true);
      setPin('');
    }
  }, [busy, pin, unlock]);

  useEffect(() => {
    if (forgot) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') back();
      else if (e.key === 'Enter') void submit();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, back, submit, forgot]);

  const slots = Math.max(4, pin.length);

  return (
    <div className="safe-t safe-b flex min-h-dvh flex-col bg-paper text-ink">
      <div className="mx-auto flex w-full max-w-[22rem] flex-1 flex-col items-center justify-center px-4 py-10">
        <CompassRose size={52} ticks className="text-magenta" />
        <h1 className="t-display mt-5 text-[2rem] text-ink">Rumo</h1>
        <p className="mt-1 text-ink-2">Digite seu PIN para abrir.</p>

        <div className="mt-8 flex h-6 items-center gap-3" aria-hidden>
          {Array.from({ length: slots }, (_, i) => (
            <motion.span
              key={i}
              layout
              className={cn(
                'size-3.5 rounded-full border transition-colors duration-150',
                i < pin.length ? 'border-ink bg-ink' : 'border-ink-3',
              )}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            />
          ))}
        </div>
        <p className="sr-only" aria-live="polite">
          {pin.length} dígitos digitados
        </p>
        <p className="mt-3 min-h-6 text-center text-[0.9375rem] text-ink-2" role="status">
          {busy ? 'Abrindo…' : error ? 'PIN não confere. Tente de novo.' : ''}
        </p>

        <div className="mt-4 grid w-full grid-cols-3 border-l border-t border-rule" role="group" aria-label="Teclado numérico">
          {KEYS.map((k) => (
            <Key key={k} onClick={() => press(k)} label={k} disabled={busy}>
              {k}
            </Key>
          ))}
          <Key onClick={back} label="Apagar último dígito" disabled={busy || !pin}>
            <svg viewBox="0 0 20 20" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
              <path d="M7 5h10v10H7l-4.5-5L7 5Z" strokeLinejoin="round" />
              <path d="m9.5 8 4 4m0-4-4 4" />
            </svg>
          </Key>
          <Key onClick={() => press('0')} label="0" disabled={busy}>
            0
          </Key>
          <Key onClick={() => void submit()} label="Abrir" disabled={busy || pin.length < 4} primary>
            <span className="text-base font-[680] t-cond">Abrir</span>
          </Key>
        </div>

        <Button variant="quiet" className="mt-6" onClick={() => setForgot(true)}>
          Esqueci o PIN
        </Button>
      </div>

      <ForgotSheet open={forgot} onClose={() => setForgot(false)} />
    </div>
  );
}

function Key({
  children,
  onClick,
  label,
  disabled,
  primary,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className={cn(
        't-num grid h-16 place-items-center border-b border-r border-rule text-[1.625rem] font-[540] transition-colors duration-100 active:bg-paper-3 disabled:opacity-40',
        primary ? 'text-magenta hover:bg-magenta-soft' : 'text-ink hover:bg-paper-2',
      )}
    >
      {children}
    </button>
  );
}

export function WipeSheet({
  open,
  onClose,
  title,
  children,
  everywhere = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  everywhere?: boolean;
}) {
  const wipe = useApp((s) => s.wipe);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);
  const ok = typed.trim().toUpperCase() === 'APAGAR';
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-4 text-ink-2">
        {children}
        <TextField
          label="Digite APAGAR para confirmar"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="quiet" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="ink"
            disabled={!ok || busy}
            onClick={async () => {
              setBusy(true);
              await wipe(everywhere);
              setBusy(false);
              onClose();
            }}
          >
            {busy ? 'Apagando…' : everywhere ? 'Apagar tudo' : 'Apagar deste aparelho'}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function ForgotSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <WipeSheet open={open} onClose={onClose} title="Sem o PIN, os dados não voltam">
      <p>
        Seus registros estão cifrados com uma chave que só o seu PIN gera. Ninguém, nem o Rumo, consegue abrir esses dados sem ele.
      </p>
      <p>Se não lembrar, apague os dados deste aparelho. A cópia cifrada na sua conta volta logo em seguida.</p>
    </WipeSheet>
  );
}
