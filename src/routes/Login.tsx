import { useState } from 'react';
import { useApp } from '@/store/app';
import { CompassRose } from '@/components/marks/Marks';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import type { SignInError } from '@/lib/cloud';

const MESSAGES: Record<SignInError, string> = {
  credentials: 'E-mail ou senha não conferem.',
  network: 'Sem conexão. Tente de novo quando estiver on-line.',
  'too-many': 'Muitas tentativas. Espere alguns minutos.',
  unknown: 'Não consegui entrar agora. Tente de novo.',
};

export default function Login() {
  const signIn = useApp((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SignInError | null>(null);

  const submit = async () => {
    if (busy || !email || !password) return;
    setBusy(true);
    setError(null);
    const err = await signIn(email, password);
    if (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <div className="safe-t safe-b flex min-h-dvh flex-col bg-paper text-ink">
      <div className="mx-auto flex w-full max-w-[22rem] flex-1 flex-col items-center justify-center px-4 py-10">
        <CompassRose size={52} ticks className="text-magenta" />
        <h1 className="t-display mt-5 text-[2rem] text-ink">Rumo</h1>
        <p className="mt-1 text-center text-ink-2">Entre para guardar e sincronizar seus registros.</p>

        <form
          className="mt-8 flex w-full flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <TextField
            label="E-mail"
            type="email"
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Senha"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="min-h-6 text-[0.9375rem] text-ink-2" role="status">
            {error ? MESSAGES[error] : ''}
          </p>
          <Button type="submit" variant="ink" disabled={busy || !email || !password}>
            {busy ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-3">
          Os registros são cifrados no aparelho com uma chave que vem da sua senha. O servidor guarda só texto ilegível.
        </p>
      </div>
    </div>
  );
}
