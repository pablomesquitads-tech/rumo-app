# Product

<!-- impeccable:product-schema 1 -->

> Inferido do documento "App de Autorregulação para Universitário com TDAH: Evidências Científicas e Arquitetura" e do pedido do usuário. A rodada de perguntas foi cancelada; os itens marcados *(inferido)* aguardam confirmação.

## Platform

web

## Stack

delegated *(inferido)*: React 18 + TypeScript + Vite, Tailwind CSS, Zustand, Dexie (IndexedDB), Recharts, vite-plugin-pwa — a stack nomeada no próprio documento. Componentes reaproveitados de `C:\Users\pablo\gitrepos\design-kit` (pedido explícito do usuário).

## Users

Um universitário com TDAH, medicado, que foge do estudo para jogos, redes sociais, projetos paralelos ("criar apps") e masturbação/pornografia. Usa o app no notebook enquanto estuda e no celular (Android ou iPhone) no momento do impulso, na cama, no ônibus, na biblioteca.

## Product Purpose

Nome: **Rumo** *(inferido do documento)*. Ferramenta de autoajuda guiada por evidências (TCC para TDAH, intenções de implementação, controle de estímulos, urge surfing/MBRP, ACT, análise funcional, autocompaixão). Reduz a fricção para começar a tarefa, aumenta a fricção para fugir, oferece regulação emocional no momento da fissura e trata lapsos como dado. Complementa medicação e profissional; não substitui.

Sucesso: mais minutos de estudo por semana, mais blocos planejados iniciados, mais problemas evitados resolvidos, impulsos atravessados sem obedecer.

## Positioning

Não é um app de produtividade com gamificação nem um contador de "dias limpos". Cada função cita a técnica com respaldo e recusa o que não tem (streak que zera, "dopamina esgotada", Pomodoro de 25 min como verdade).

## Operating Context

Fluxos diários: início do dia (≤4 min), bloco de foco, SOS no impulso, revisão noturna (≤3 min), revisão semanal (15 min, domingo). Dados só no aparelho.

## Capabilities and Constraints

- Módulos: Onboarding, Hoje (check-in + 3 prioridades + se-então + WOOP), Bloco de Foco, SOS, Caixa de Problemas Evitados, Lapso/Análise em Cadeia, Revisões, Base (sono/exercício), Progresso, Ajuda & Segurança (CVV 188, SAMU 192, PHQ-9/GAD-7), Configurações (modo discreto, exportar, apagar, PIN).
- Local-first; sem analytics, sem CDNs externas em runtime.
- Um PWA não detecta nem bloqueia outros apps; orienta Tempo de Uso / Bem-estar Digital.
- Notificações: máx. 3/dia, silêncio 23h–8h, sem conteúdo sensível.

## Brand Commitments

Português do Brasil. Tom gentil, direto, sem moralismo. "Lapso", nunca "fracasso/recaída". Sem vermelho punitivo, sem pontos/rankings, sem emojis tristes. Modo discreto com rótulos neutros ("Impulso S").

## Evidence on Hand

As referências científicas do documento-fonte. Nenhum depoimento, usuário ou métrica real existe; não inventar.

## Product Principles

1. Começar é barato, fugir é caro.
2. Feedback imediato no fim de cada bloco.
3. Lapso é dado, não fracasso: toda análise termina em uma ação concreta.
4. Medir função, não moral.
5. Uma decisão por tela; o app não pode virar o novo projeto para não estudar.

## Accessibility & Inclusion

WCAG AA, fontes grandes, pouca carga cognitiva por tela (TDAH), alvos de toque ≥44px, respeito a `prefers-reduced-motion`.
