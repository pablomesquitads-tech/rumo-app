// Dados SINTÉTICOS para desenvolvimento (só em `npm run dev`): window.rumoSeed() / window.rumoReset().
import { useApp } from '@/store/app';
import { defaultProfile, emptyData } from './defaults';
import type { AppData, EscapeType } from './types';
import { addDays, dayKey, uid } from './utils';

function at(daysAgo: number, h: number, m = 0) {
  const d = addDays(new Date(), -daysAgo);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export function buildSeed(): AppData {
  const data = emptyData();
  const profile = defaultProfile();
  profile.onboardedAt = new Date().toISOString();
  profile.values = ['Aprender de verdade', 'Saúde', 'Amizades'];
  profile.escapes = [
    { type: 'games', when: 'depois do almoço', where: 'quarto', goal: 'Só depois das 21h' },
    { type: 'social', when: 'ao travar num exercício', where: 'mesa', goal: '10 min por app por dia' },
    { type: 'sexual', when: 'noite, sozinho', where: 'quarto', goal: 'Não no horário de estudo' },
  ];
  data.profile = profile;

  const t1 = { id: uid(), title: 'Lista 3 de Cálculo II', area: 'academic' as const, firstStep: 'Abrir o PDF da lista 3 na página 1', ifThen: 'Se forem 14h e eu estiver na biblioteca, então abro o PDF da lista 3', aversiveness: 8, status: 'todo' as const, createdAt: at(0, 8) };
  const t2 = { id: uid(), title: 'Resumo do capítulo 4 de Bioquímica', area: 'academic' as const, firstStep: 'Ler só o primeiro parágrafo', ifThen: 'Se eu terminar o almoço, então leio o primeiro parágrafo na mesa', aversiveness: 5, status: 'todo' as const, createdAt: at(0, 8) };
  const t3 = { id: uid(), title: 'Pagar a conta de luz', area: 'life' as const, firstStep: 'Abrir o app do banco', ifThen: 'Se eu sair da aula das 18h, então abro o app do banco no ônibus', aversiveness: 6, status: 'todo' as const, createdAt: at(0, 8) };
  data.tasks = [t1, t2, t3];
  data.dayPlans = [
    {
      date: dayKey(),
      priorities: [t1.id, t2.id, t3.id],
      antiEscapePlans: ['Se eu sentir vontade de abrir o jogo, então aperto o SOS', 'Se eu travar num exercício, então anoto a dúvida e pulo para o próximo'],
      plannedBlocks: ['09:00', '14:00', '16:30', '20:00'],
      woop: { wish: 'Terminar a lista 3', outcome: 'Chegar na prova sem pânico', obstacle: 'Achar que preciso entender tudo antes de começar', plan: 'Se eu travar, então faço o próximo exercício e marco a dúvida' },
    },
  ];
  data.checkins = [{ id: uid(), at: at(0, 8, 10), kind: 'morning', mood: 6, energy: 5, sleepHours: 6.5, location: 'home' }];

  const types: EscapeType[] = ['games', 'social', 'sexual', 'side_projects'];
  for (let d = 1; d < 30; d++) {
    const n = (d * 7) % 4;
    for (let b = 0; b < n; b++) {
      const start = at(d, 9 + b * 3);
      data.focusSessions.push({ id: uid(), start, end: start, plannedMin: 25, breakMin: 5, completed: b < n - (d % 3 === 0 ? 1 : 0), focusRating: 5 + (d % 4), distractionsTapped: d % 3, envChecklist: [true, true, d % 2 === 0] });
    }
    if (d % 3 === 0) {
      const type = types[d % 4];
      data.urges.push({ id: uid(), at: at(d, 15 + (d % 6)), type, intensityBefore: 7 + (d % 3), intensityAfter: 4 + (d % 3), toolsUsed: ['surf', 'alt_action'], altAction: 'Caminhar 10 minutos', outcome: d % 9 === 0 ? 'lapsed' : 'resisted' });
    }
    if (d % 5 === 0) {
      data.lapses.push({ id: uid(), at: at(d, 22), type: types[(d + 1) % 4], minutes: 40, chain: d % 10 === 0 ? { vulnerabilities: ['Sono ruim', 'Sozinho no quarto'], trigger: 'Travei no exercício 4', thoughts: 'Só 5 minutos', behavior: 'Abri o jogo', shortTermConsequence: 'Alívio', longTermConsequence: 'Perdi a noite de estudo', newIfThen: 'Se eu travar depois das 21h, então vou para a sala com o notebook' } : undefined });
    }
    data.health.push({ date: dayKey(addDays(new Date(), -d)), bedtime: d % 4 === 0 ? '01:30' : '23:40', wake: '07:30', exerciseMin: d % 2 === 0 ? 25 : 0 });
  }
  data.problems = [
    { id: uid(), title: 'Renovar a matrícula', discomfort: 7, costOfDelay: 'Perder a vaga na disciplina', costScore: 9, smallestStep: 'Abrir o portal do aluno', status: 'open', createdAt: at(4, 10) },
    { id: uid(), title: 'Responder o e-mail do orientador', discomfort: 8, costOfDelay: 'Ele vai achar que desisti', costScore: 6, smallestStep: 'Escrever só a primeira frase', status: 'open', createdAt: at(9, 10) },
    { id: uid(), title: 'Marcar dentista', discomfort: 4, costOfDelay: 'Dor pode piorar', costScore: 5, smallestStep: 'Procurar o telefone', status: 'resolved', createdAt: at(20, 10), resolvedAt: at(12, 10) },
  ];
  return data;
}

export function installDevSeed() {
  const w = window as unknown as Record<string, unknown>;
  w.rumoSeed = async () => {
    await useApp.getState().importData(buildSeed());
    location.assign('/');
  };
  w.rumoReset = async () => {
    await useApp.getState().wipe(false);
    location.assign('/');
  };
  // ?demo na URL: semeia automaticamente um perfil vazio (capturas de tela headless).
  const target = sessionStorage.getItem('rumo-demo');
  if (target !== null) {
    sessionStorage.removeItem('rumo-demo');
    const run = (s: ReturnType<typeof useApp.getState>) => {
      if (s.status !== 'ready') return false;
      if (!s.data.profile?.onboardedAt) void useApp.getState().importData(buildSeed()).then(() => location.replace(target));
      else location.replace(target);
      return true;
    };
    if (!run(useApp.getState())) {
      const unsub = useApp.subscribe((s) => {
        if (run(s)) unsub();
      });
    }
  }
}
