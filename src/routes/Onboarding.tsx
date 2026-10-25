import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useApp, useData } from '@/store/app';
import { defaultProfile, escapeLabel, ESCAPE_ORDER, FOCUS_PRESETS } from '@/lib/defaults';
import { setPin as savePin } from '@/lib/storage';
import type { EscapeType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CompassRose } from '@/components/marks/Marks';
import { Button } from '@/components/ui/Button';
import { Check, Chip } from '@/components/ui/Check';
import { TextField } from '@/components/ui/Field';
import { Flow, FlowQuestion } from '@/components/ui/Flow';
import { Segmented } from '@/components/ui/Segmented';

const EASE = [0.16, 1, 0.3, 1] as const;

export const SUGGESTED_VALUES = [
  'Aprender de verdade',
  'Me formar',
  'Saúde',
  'Família',
  'Amizades',
  'Autonomia',
  'Curiosidade',
  'Criatividade',
  'Ajudar pessoas',
  'Tranquilidade',
  'Honestidade comigo',
  'Independência financeira',
];

const GOAL_SUGGESTIONS = ['Reduzir o tempo por dia', 'Só fora dos horários de estudo', 'Só em horários que eu combinar', 'Pausa total por um período'];

export const BLOCKERS = [
  {
    key: 'ios',
    title: 'iPhone: Tempo de Uso',
    hint: 'Ajustes › Tempo de Uso › Limites de Apps › Adicionar Limite. Escolha Jogos e Redes Sociais e um tempo curto. Em Conteúdo e Privacidade › Conteúdo da Web, dá para limitar sites adultos.',
  },
  {
    key: 'android',
    title: 'Android: Bem-estar digital',
    hint: 'Configurações › Bem-estar digital e controle parental › Painel › toque no app › Timer do app. O Modo foco pausa os apps escolhidos durante o estudo.',
  },
  {
    key: 'browser',
    title: 'Notebook: extensão de bloqueio',
    hint: 'Instale LeechBlock NG (Chrome, Firefox, Edge) ou Cold Turkey (Windows, macOS) e bloqueie os sites de fuga nos seus horários de estudo.',
  },
  {
    key: 'notifications',
    title: 'Notificações de jogos e redes desligadas',
    hint: 'Cada notificação é um convite para sair. Desligue as dos apps de fuga nas configurações do aparelho.',
  },
] as const;

type StepId = 'welcome' | 'mood' | 'wait' | 'lapse' | 'values' | 'escapes' | `map:${EscapeType}` | `goal:${EscapeType}` | 'blockers' | 'rhythm' | 'contacts' | 'pin' | 'done';

export default function Onboarding() {
  const nav = useNavigate();
  const profile = useData((d) => d.profile);
  const discreet = useData((d) => d.settings.discreet);
  const setProfile = useApp((s) => s.setProfile);
  const setSettings = useApp((s) => s.setSettings);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!useApp.getState().data.profile) useApp.getState().mutate('profile', () => defaultProfile());
  }, []);

  const escapes = useMemo(() => profile?.escapes ?? [], [profile]);
  const steps = useMemo<StepId[]>(
    () => [
      'welcome',
      'mood',
      'wait',
      'lapse',
      'values',
      'escapes',
      ...escapes.map((e) => `map:${e.type}` as const),
      ...escapes.map((e) => `goal:${e.type}` as const),
      'blockers',
      'rhythm',
      'contacts',
      'pin',
      'done',
    ],
    [escapes],
  );

  if (!profile) return <div className="min-h-dvh bg-paper" />;

  const id = steps[Math.min(i, steps.length - 1)];
  const next = () => setI((x) => Math.min(x + 1, steps.length - 1));
  const back = () => setI((x) => Math.max(0, x - 1));

  const finish = () => {
    setProfile({ onboardedAt: new Date().toISOString() });
    nav('/checkin', { replace: true });
  };

  if (id === 'welcome') return <Welcome onStart={next} />;

  const label = (t: EscapeType) => escapeLabel(t, discreet);
  const entry = (t: EscapeType) => escapes.find((e) => e.type === t);
  const patchEscape = (t: EscapeType, patch: Partial<(typeof escapes)[number]>) =>
    setProfile({ escapes: escapes.map((e) => (e.type === t ? { ...e, ...patch } : e)) });

  let body: ReactNode;
  let footer: ReactNode = (
    <div className="flex justify-end">
      <Continue onClick={next} />
    </div>
  );

  if (id === 'mood') {
    body = (
      <>
        <FlowQuestion sub="A tarefa incomoda; o jogo, o vídeo ou o projeto paralelo tiram o incômodo na hora. Procrastinar é um alívio de humor de curto prazo, e isso é aprendizagem, não falta de caráter (Sirois & Pychyl, 2013).">
          Procrastinar não é preguiça.
        </FlowQuestion>
        <dl className="border-t border-ink">
          <Row term="Começar fica mais barato">primeiro passo de 5 minutos, bloco com um toque</Row>
          <Row term="Fugir fica mais caro">bloqueios no sistema, SOS no momento do impulso</Row>
        </dl>
      </>
    );
  } else if (id === 'wait') {
    body = (
      <>
        <FlowQuestion sub="No TDAH, esperar é desconfortável e a recompensa imediata pesa mais que a distante (modelo de via dupla de Sonuga-Barke). Não é falta de vontade: é como a motivação funciona aí.">
          Esperar custa mais para você.
        </FlowQuestion>
        <dl className="border-t border-ink">
          <Row term="Retorno imediato">no fim de cada bloco, o que você fez aparece na hora</Row>
          <Row term="Metas próximas">prioridades do dia, passos pequenos, prazos intermediários</Row>
        </dl>
      </>
    );
  } else if (id === 'lapse') {
    body = (
      <>
        <FlowQuestion sub="Quando escapar, você anota o que veio antes e sai com um plano novo. Nada de contador que zera: um dia não apaga o caminho.">
          Lapso é dado, não fracasso.
        </FlowQuestion>
        <p className="t-plan border-y border-rule py-4 text-[1.0625rem] leading-relaxed text-ink">
          O Rumo complementa a medicação e o acompanhamento com profissional. Não substitui nenhum dos dois.
        </p>
      </>
    );
  } else if (id === 'values') {
    body = <ValuesStep values={profile.values} onChange={(values) => setProfile({ values })} />;
  } else if (id === 'escapes') {
    const toggle = (t: EscapeType) =>
      setProfile({
        escapes: entry(t)
          ? escapes.filter((e) => e.type !== t)
          : ESCAPE_ORDER.filter((x) => x === t || entry(x)).map((x) => entry(x) ?? { type: x, when: '', where: '', goal: '' }),
      });
    body = (
      <>
        <FlowQuestion sub="Marque as fugas que mais tiram você do estudo. Ninguém além de você vê isto.">Para onde você costuma fugir?</FlowQuestion>
        <div className="border-t border-rule">
          {ESCAPE_ORDER.map((t) => (
            <Check key={t} checked={Boolean(entry(t))} onChange={() => toggle(t)}>
              {label(t)}
            </Check>
          ))}
        </div>
        <div className="mt-6 border-t border-ink pt-1">
          <Check
            checked={discreet}
            onChange={(v) => setSettings({ discreet: v })}
            hint="Troca os nomes por rótulos neutros, como “Impulso S”, em todo o app. Útil se alguém olhar sua tela."
          >
            Usar rótulos discretos
          </Check>
        </div>
      </>
    );
    footer = (
      <FooterRow>
        <Button variant="quiet" onClick={next}>
          Pular
        </Button>
        <Continue onClick={next} disabled={!escapes.length} />
      </FooterRow>
    );
  } else if (id.startsWith('map:')) {
    const t = id.slice(4) as EscapeType;
    const e = entry(t);
    body = (
      <>
        <FlowQuestion sub="Horário e lugar dizem onde montar o bloqueio e qual plano se-então faz sentido.">{label(t)}: quando e onde?</FlowQuestion>
        <div className="flex flex-col gap-5">
          <TextField
            label="Quando costuma acontecer"
            placeholder="depois do almoço, de noite na cama"
            value={e?.when ?? ''}
            onChange={(ev) => patchEscape(t, { when: ev.target.value })}
          />
          <TextField
            label="Onde costuma acontecer"
            placeholder="no quarto, pelo celular"
            value={e?.where ?? ''}
            onChange={(ev) => patchEscape(t, { where: ev.target.value })}
          />
        </div>
      </>
    );
  } else if (id.startsWith('goal:')) {
    const t = id.slice(5) as EscapeType;
    const goal = entry(t)?.goal ?? '';
    body = (
      <>
        <FlowQuestion sub="A meta mede o quanto isso atrapalha seus estudos e sua vida, não se você é bom ou ruim. Quem decide é você.">
          Sua meta com {label(t).toLowerCase()}
        </FlowQuestion>
        <div className="flex flex-wrap gap-2">
          {GOAL_SUGGESTIONS.map((g) => (
            <Chip key={g} selected={goal === g} onClick={() => patchEscape(t, { goal: goal === g ? '' : g })}>
              {g}
            </Chip>
          ))}
        </div>
        <TextField
          wrapClassName="mt-6"
          label="Ou escreva com suas palavras"
          placeholder="no máximo 1 h de jogo depois das 21h"
          value={goal}
          onChange={(ev) => patchEscape(t, { goal: ev.target.value })}
        />
      </>
    );
  } else if (id === 'blockers') {
    body = (
      <>
        <FlowQuestion sub="Um app web não consegue bloquear outros apps. Quem bloqueia é o sistema. Marque o que já configurou; dá para voltar depois em Ajustes.">
          Deixe a fuga mais cara.
        </FlowQuestion>
        <div className="border-t border-rule">
          {BLOCKERS.map((b) => (
            <Check
              key={b.key}
              checked={Boolean(profile.blockersChecklist[b.key])}
              onChange={(v) => setProfile({ blockersChecklist: { ...profile.blockersChecklist, [b.key]: v } })}
              hint={b.hint}
            >
              {b.title}
            </Check>
          ))}
        </div>
      </>
    );
  } else if (id === 'rhythm') {
    body = <RhythmStep />;
  } else if (id === 'contacts') {
    const c = profile.contacts;
    const patch = (k: keyof typeof c, v: string) => setProfile({ contacts: { ...c, [k]: v || undefined } });
    body = (
      <>
        <FlowQuestion sub="Opcional. Nome e telefone ficam cifrados na sua conta e aparecem na tela de Ajuda.">Quem pode ajudar?</FlowQuestion>
        <div className="flex flex-col gap-5">
          <TextField label="Psicologia da universidade" placeholder="Serviço-escola, (11) 0000-0000" value={c.psychology ?? ''} onChange={(e) => patch('psychology', e.target.value)} />
          <TextField label="Psiquiatra" placeholder="Dra. Ana, (11) 90000-0000" value={c.psychiatrist ?? ''} onChange={(e) => patch('psychiatrist', e.target.value)} />
          <TextField label="Pessoa de confiança" placeholder="Nome e telefone" value={c.trusted ?? ''} onChange={(e) => patch('trusted', e.target.value)} />
        </div>
      </>
    );
    footer = (
      <FooterRow>
        <Button variant="quiet" onClick={next}>
          Pular
        </Button>
        <Continue onClick={next} />
      </FooterRow>
    );
  } else if (id === 'pin') {
    body = <PinStep onDone={next} />;
    footer = null;
  } else {
    body = <Done />;
    footer = (
      <Button variant="primary" size="lg" block onClick={finish}>
        Montar o plano de hoje
      </Button>
    );
  }

  return (
    <div className="safe-t safe-b flex min-h-dvh flex-col bg-paper px-4 pt-5 text-ink sm:px-8 sm:pt-10">
      <Flow step={i - 1} total={steps.length - 1} onBack={back} footer={footer} className="flex-1">
        {body}
      </Flow>
    </div>
  );
}

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="safe-t safe-b relative flex min-h-dvh flex-col overflow-hidden bg-paper text-ink">
      <div className="neatline-x" aria-hidden />
      <div className="graticule pointer-events-none absolute inset-0 opacity-70" aria-hidden />
      <div className="relative mx-auto grid w-full max-w-[72rem] flex-1 items-center gap-6 px-5 py-10 sm:px-10 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
        <motion.div
          className="order-first flex justify-center text-magenta lg:order-last"
          initial={{ rotate: -38, opacity: 0.001, scale: 0.94 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          transition={{ duration: 1.6, ease: EASE }}
        >
          <CompassRose size={420} ticks className="h-auto w-[min(62vw,17rem)] lg:w-[min(36vw,30rem)]" />
        </motion.div>
        <div className="flex flex-col">
          <h1 className="t-display text-[clamp(5rem,22vw,11rem)] leading-[0.86] text-ink">Rumo</h1>
          <p className="t-title mt-5 max-w-[30rem] text-[clamp(1.25rem,3.6vw,1.75rem)] text-ink">
            Para começar a estudar, atravessar o impulso e voltar ao rumo quando escapar.
          </p>
          <p className="mt-6 max-w-[30rem] border-t border-rule pt-4 text-[1.0625rem] leading-relaxed text-ink-2">
            Seus registros são cifrados no aparelho antes de ir para a sua conta. Sem análise de uso.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Button variant="primary" size="lg" onClick={onStart}>
              Começar a configurar
            </Button>
            <span className="t-label t-num">cerca de 10 minutos</span>
          </div>
        </div>
      </div>
      <div className="neatline-x" aria-hidden />
    </div>
  );
}

function ValuesStep({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const full = values.length >= 5;
  const toggle = (v: string) => onChange(values.includes(v) ? values.filter((x) => x !== v) : full ? values : [...values, v]);
  const add = () => {
    const v = draft.trim();
    if (!v || full || values.includes(v)) return;
    onChange([...values, v]);
    setDraft('');
  };
  const custom = values.filter((v) => !SUGGESTED_VALUES.includes(v));
  return (
    <>
      <FlowQuestion sub="Até 5. Eles aparecem quando a tarefa pesar, para lembrar por que ela vale.">O que importa para você?</FlowQuestion>
      <div className="flex flex-wrap gap-2">
        {[...SUGGESTED_VALUES, ...custom].map((v) => {
          const on = values.includes(v);
          return (
            <Chip key={v} selected={on} onClick={() => toggle(v)} className={cn(!on && full && 'opacity-45')}>
              {v}
            </Chip>
          );
        })}
      </div>
      <form
        className="mt-6 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <TextField
          wrapClassName="flex-1"
          label="Outro valor"
          placeholder="com suas palavras"
          value={draft}
          maxLength={60}
          disabled={full}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button type="submit" size="md" className="h-12" disabled={full || !draft.trim()}>
          Adicionar
        </Button>
      </form>
      <p className="t-label t-num mt-4">{values.length} de 5</p>
    </>
  );
}

function RhythmStep() {
  const profile = useData((d) => d.profile);
  const setProfile = useApp((s) => s.setProfile);
  if (!profile) return null;
  const current = `${profile.focusDefaults.workMin}/${profile.focusDefaults.breakMin}`;
  return (
    <>
      <FlowQuestion sub="25 minutos não é número mágico: não há estudo mostrando que é o ideal. Escolha o bloco que você consegue começar hoje; dá para mudar a cada vez.">
        Quanto dura um bloco?
      </FlowQuestion>
      <Segmented
        label="Duração padrão do bloco"
        className="w-full"
        value={current}
        onChange={(v) => {
          const [workMin, breakMin] = v.split('/').map(Number);
          setProfile({ focusDefaults: { workMin, breakMin } });
        }}
        options={FOCUS_PRESETS.map((p) => ({ value: `${p.workMin}/${p.breakMin}`, label: `${p.workMin} + ${p.breakMin}` }))}
      />
      <p className="mt-2 text-sm text-ink-3">minutos de foco + minutos de pausa</p>
      <TextField
        wrapClassName="mt-8 max-w-[14rem]"
        type="time"
        label="Horário-alvo de dormir"
        value={profile.bedtimeTarget}
        onChange={(e) => e.target.value && setProfile({ bedtimeTarget: e.target.value })}
        hint="Sono curto piora atenção e controle de impulsos."
      />
    </>
  );
}

function PinStep({ onDone }: { onDone: () => void }) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = /^\d{4,8}$/.test(pin);
  const matches = valid && pin === confirm;
  const problem = pin && !valid ? 'Use de 4 a 8 números.' : confirm.length >= pin.length && confirm && !matches ? 'Os dois PINs não são iguais.' : '';

  const save = async () => {
    if (!matches) return;
    setBusy(true);
    await savePin(pin);
    await useApp.getState().importData(useApp.getState().data);
    setBusy(false);
    onDone();
  };

  return (
    <>
      <FlowQuestion sub="Sem PIN, seus dados já ficam cifrados com uma chave guardada neste aparelho. Com PIN, a chave sai dele: ninguém abre o Rumo sem o número.">
        Quer proteger com um PIN?
      </FlowQuestion>
      <div className="flex flex-col gap-5 sm:max-w-[20rem]">
        <TextField label="PIN (4 a 8 números)" type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
        <TextField label="Repita o PIN" type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ''))} />
      </div>
      <p className="mt-3 min-h-6 text-[0.9375rem] text-ink-2" role="status">
        {problem}
      </p>
      <p className="mt-2 border-t border-rule pt-4 text-ink-2">
        Se esquecer o PIN, não há como recuperar os dados: só apagar e começar de novo.
      </p>
      <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button variant="quiet" onClick={onDone} disabled={busy}>
          Seguir sem PIN
        </Button>
        <Button variant="primary" size="lg" onClick={() => void save()} disabled={!matches || busy}>
          {busy ? 'Cifrando…' : 'Definir PIN'}
        </Button>
      </div>
    </>
  );
}

function Done() {
  const profile = useData((d) => d.profile);
  const discreet = useData((d) => d.settings.discreet);
  if (!profile) return null;
  return (
    <>
      <div className="mb-6 text-magenta">
        <CompassRose size={64} ticks />
      </div>
      <FlowQuestion sub="Agora o plano de hoje: até 3 prioridades, cada uma com um primeiro passo de 5 minutos.">Rumo traçado.</FlowQuestion>
      <dl className="border-t border-ink">
        <Row term="Valores">{profile.values.length ? profile.values.join(', ') : 'nenhum por enquanto'}</Row>
        <Row term="Fugas mapeadas">
          {profile.escapes.length ? profile.escapes.map((e) => escapeLabel(e.type, discreet)).join(', ') : 'nenhuma por enquanto'}
        </Row>
        <Row term="Bloco padrão">
          <span className="t-num">
            {profile.focusDefaults.workMin} min + {profile.focusDefaults.breakMin} de pausa
          </span>
        </Row>
        <Row term="Dormir às">
          <span className="t-num">{profile.bedtimeTarget}</span>
        </Row>
      </dl>
      <p className="mt-4 text-sm text-ink-3">Tudo isso muda em Ajustes quando quiser.</p>
    </>
  );
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-rule py-3.5 sm:grid-cols-[13rem_1fr] sm:gap-4">
      <dt className="t-label pt-0.5 text-ink">{term}</dt>
      <dd className="text-ink-2">{children}</dd>
    </div>
  );
}

function Continue({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button variant="primary" size="lg" onClick={onClick} disabled={disabled} className="min-w-[10rem]">
      Continuar
    </Button>
  );
}

function FooterRow({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-between gap-3">{children}</div>;
}
