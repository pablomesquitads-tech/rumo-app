import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp, useData } from '@/store/app';
import { Page, ScreenHeader, Section } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { Check } from '@/components/ui/Check';
import { TextField } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Dialog';
import { toast } from '@/components/ui/toast';
import { Cells } from '@/components/moment/kit';
import { WipeSheet } from '@/routes/Lock';
import { FOCUS_PRESETS } from '@/lib/defaults';
import { CSV_COLLECTIONS, exportCSV, exportJSON, parseBackup, type ParseResult } from '@/lib/export';
import { MAX_PER_DAY, QUIET_FROM, QUIET_UNTIL, canNotify } from '@/lib/notifications';
import { hasPin, setPin } from '@/lib/storage';
import type { ThemePref } from '@/lib/types';

type Parsed = Extract<ParseResult, { ok: true }>;

export default function Settings() {
  const settings = useData((d) => d.settings);
  const profile = useData((d) => d.profile);
  const data = useData((d) => d);
  const setSettings = useApp((s) => s.setSettings);
  const setProfile = useApp((s) => s.setProfile);
  const importData = useApp((s) => s.importData);

  const [pin, setPinState] = useState(false);
  const [pinA, setPinA] = useState('');
  const [pinB, setPinB] = useState('');
  const [busy, setBusy] = useState(false);
  const [wipe, setWipe] = useState(false);
  const [pending, setPending] = useState<Parsed | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void hasPin().then(setPinState);
  }, []);

  const pinValid = /^\d{4,8}$/.test(pinA) && pinA === pinB;

  const savePin = async () => {
    if (!pinValid || busy) return;
    setBusy(true);
    await setPin(pinA);
    setBusy(false);
    setPinState(true);
    setPinA('');
    setPinB('');
    toast('PIN definido.');
  };

  const removePin = async () => {
    if (busy) return;
    setBusy(true);
    await setPin(null);
    setBusy(false);
    setPinState(false);
    setSettings({ lockAfterMin: 0 });
    toast('PIN removido.');
  };

  const toggleNotifications = async (on: boolean) => {
    if (!on) return setSettings({ notificationsEnabled: false });
    if (typeof window === 'undefined' || !('Notification' in window)) return toast('Este navegador não mostra notificações.');
    const perm = canNotify() ? 'granted' : await Notification.requestPermission();
    if (perm === 'granted') setSettings({ notificationsEnabled: true });
    else toast('O navegador bloqueou as notificações.');
  };

  const pickFile = async (f: File | undefined) => {
    if (!f) return;
    setImportError(null);
    const r = parseBackup(await f.text());
    if (r.ok) setPending(r);
    else setImportError(r.error);
    if (file.current) file.current.value = '';
  };

  const confirmImport = async () => {
    if (!pending) return;
    await importData(pending.data);
    setPending(null);
    toast('Backup importado.');
  };

  return (
    <Page>
      <ScreenHeader title="Ajustes" description="Tudo fica só neste aparelho, cifrado. Nada é enviado para fora." />

      <div className="grid gap-x-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col">
          <Section label="Aparência">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="t-label">Carta</span>
              <Segmented<ThemePref>
                label="Tema"
                value={settings.theme}
                onChange={(theme) => setSettings({ theme })}
                options={[
                  { value: 'auto', label: 'Automático' },
                  { value: 'day', label: 'Dia' },
                  { value: 'night', label: 'Noite' },
                ]}
              />
            </div>
            <div className="flex flex-col">
              <Check checked={settings.reducedMotion} onChange={(reducedMotion) => setSettings({ reducedMotion })} hint="Troca as ondas e transições por indicadores estáticos.">
                Reduzir movimento
              </Check>
              <Check checked={settings.discreet} onChange={(discreet) => setSettings({ discreet })} hint="Os tipos de impulso aparecem com rótulos neutros, como “Impulso S”.">
                Modo discreto
              </Check>
            </div>
          </Section>

          <Section label="Notificações" aside={<span className="t-num">até {MAX_PER_DAY} por dia</span>}>
            <Check
              checked={settings.notificationsEnabled}
              onChange={(v) => void toggleNotifications(v)}
              hint={`Silêncio das ${QUIET_FROM}h às ${QUIET_UNTIL}h. O texto nunca cita o tipo de impulso.`}
            >
              Lembretes locais
            </Check>
          </Section>

          <Section label="Blocos de foco">
            <Cells
              label="Duração padrão do bloco"
              cols={4}
              value={profile?.focusDefaults.workMin}
              onChange={(workMin) => setProfile({ focusDefaults: { workMin, breakMin: FOCUS_PRESETS.find((p) => p.workMin === workMin)?.breakMin ?? 5 } })}
              options={FOCUS_PRESETS.map((p) => ({ value: p.workMin as number, label: `${p.workMin} min`, hint: `${p.breakMin} de pausa` }))}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="set-bed" className="t-label">
                Horário-alvo para dormir
              </label>
              <input
                id="set-bed"
                type="time"
                value={profile?.bedtimeTarget ?? '23:30'}
                onChange={(e) => e.target.value && setProfile({ bedtimeTarget: e.target.value })}
                className="t-num t-title h-14 w-40 rounded-[3px] border border-rule-2 bg-paper px-3 text-[1.5rem] text-ink transition-colors hover:border-ink-3 focus:border-ink focus:outline-none"
              />
            </div>
          </Section>
        </div>

        <div className="flex min-w-0 flex-col">
          <Section label="PIN" aside={<span>{pin ? 'ativo' : 'desativado'}</span>}>
            {pin ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="t-label">Trancar após</span>
                  <Segmented
                    label="Trancar após inatividade"
                    value={String(settings.lockAfterMin)}
                    onChange={(v) => setSettings({ lockAfterMin: Number(v) })}
                    options={[
                      { value: '0', label: 'Nunca' },
                      { value: '1', label: '1 min' },
                      { value: '5', label: '5 min' },
                      { value: '15', label: '15 min' },
                    ]}
                  />
                </div>
                <p className="text-sm text-ink-3">Sem o PIN, os dados não voltam. Se esquecer, só dá para apagar tudo e recomeçar.</p>
                <Button variant="secondary" className="self-start" disabled={busy} onClick={() => void removePin()}>
                  Remover PIN
                </Button>
              </>
            ) : (
              <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void savePin();
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    label="Novo PIN"
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    maxLength={8}
                    value={pinA}
                    onChange={(e) => setPinA(e.target.value.replace(/\D/g, ''))}
                    hint="De 4 a 8 dígitos."
                  />
                  <TextField
                    label="Repita o PIN"
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    maxLength={8}
                    value={pinB}
                    onChange={(e) => setPinB(e.target.value.replace(/\D/g, ''))}
                    hint={pinB && pinA !== pinB ? 'Os dois PINs precisam ser iguais.' : undefined}
                  />
                </div>
                <p className="text-sm text-ink-3">O PIN cifra seus registros neste aparelho. Sem ele, os dados não voltam.</p>
                <Button type="submit" variant="ink" className="self-start" disabled={!pinValid || busy}>
                  Definir PIN
                </Button>
              </form>
            )}
          </Section>

          <Section label="Seus dados">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => exportJSON(data)}>
                Exportar backup (JSON)
              </Button>
              <Button variant="secondary" onClick={() => file.current?.click()}>
                Importar backup
              </Button>
              <input ref={file} type="file" accept="application/json,.json" className="sr-only" aria-label="Arquivo de backup" onChange={(e) => void pickFile(e.target.files?.[0])} />
            </div>
            {importError && (
              <p role="alert" className="text-[0.9375rem] text-light">
                {importError}
              </p>
            )}
            <div className="flex flex-col">
              <span className="t-label pb-2">Planilhas (CSV)</span>
              {CSV_COLLECTIONS.map((c) => (
                <div key={c.key} className="flex min-h-12 items-center justify-between gap-3 border-b border-rule last:border-b-0">
                  <span className="text-[0.9375rem] text-ink">{c.label}</span>
                  <Button variant="quiet" size="sm" onClick={() => exportCSV(data, c.key, settings.discreet)}>
                    Baixar
                  </Button>
                </div>
              ))}
            </div>
          </Section>

          <Section label="Contatos e segurança">
            <p className="text-[0.9375rem] text-ink-2">
              Contatos de apoio, triagens e o relatório para levar à consulta ficam em{' '}
              <Link to="/ajuda" className="text-ink underline">
                Ajuda
              </Link>
              .
            </p>
          </Section>

          <Section label="Apagar">
            <p className="text-[0.9375rem] text-ink-2">Remove todos os registros e o perfil deste aparelho. Não pode ser desfeito.</p>
            <Button variant="secondary" className="self-start" onClick={() => setWipe(true)}>
              Apagar tudo deste aparelho
            </Button>
          </Section>
        </div>
      </div>

      <WipeSheet open={wipe} onClose={() => setWipe(false)} title="Apagar tudo?">
        <p>Isso remove check-ins, blocos, impulsos, lapsos e o perfil. Se quiser guardar uma cópia, exporte o backup antes.</p>
      </WipeSheet>

      <Sheet open={pending != null} onClose={() => setPending(null)} title="Importar este backup?">
        <div className="flex flex-col gap-4 text-ink-2">
          <p>
            O arquivo tem <span className="t-num text-ink">{pending?.count}</span> registros
            {pending?.exportedAt ? ` de ${new Date(pending.exportedAt).toLocaleDateString('pt-BR')}` : ''}. Os dados atuais deste aparelho serão substituídos.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="quiet" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button variant="ink" onClick={() => void confirmImport()}>
              Substituir dados
            </Button>
          </div>
        </div>
      </Sheet>
    </Page>
  );
}
