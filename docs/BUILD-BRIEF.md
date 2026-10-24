# Rumo — brief de construção para os agentes

Leia isto inteiro antes de escrever código. Fonte científica e de produto:
`C:\Users\pablo\Downloads\App de Autorregulação para Universitário com TDAH_ Evidências Científicas e Arquitetura.md`
(seções 2–4; a seção 5 é a especificação resumida). `PRODUCT.md` na raiz resume o produto.

## Stack (já instalada — não adicione dependências sem necessidade real)
React 18 + TS (strict) + Vite 5 + Tailwind 4 (tokens em `src/styles/index.css`), `motion` (`import { motion } from 'motion/react'`),
Zustand (`src/store/app.ts`), Dexie cifrado (`src/lib/storage.ts`), Recharts, react-router-dom 6. Alias `@/` → `src/`.
Componentes de referência extra (copiar e adaptar, nunca importar de lá): `C:\Users\pablo\gitrepos\design-kit` (ver `notes.md`).

## Dados
- Tipos: `src/lib/types.ts`. Padrões/rótulos: `src/lib/defaults.ts` (use `escapeLabel(type, discreet)` SEMPRE para nomear fugas — o modo discreto troca para "Impulso S" etc.).
- Store: `useApp` / `useData(sel)`. Escrita: `upsert(key, item)` (por `id`, ou `date` em `dayPlans`/`health`), `remove(key, id)`, `mutate(key, fn)`, `setProfile`, `setSettings`. Persistência e cifragem são automáticas. NÃO edite `src/store/app.ts`, `src/lib/storage.ts`, `src/lib/types.ts` — se precisar de um campo novo, use o que existe ou anote no relatório final.
- Utilitários: `src/lib/utils.ts` (`cn`, `uid`, `dayKey`, `fmtTime`, `fmtDate`, ...). Métricas: `src/lib/metrics.ts`.

## Rotas (cada agente só toca os arquivos que lhe foram atribuídos)
`/` Hoje · `/checkin` Plano do dia (fluxo da manhã) · `/foco` Bloco de Foco (tela cheia, fora do shell; query `?task=<id>&min=<n>`) ·
`/sos` SOS (tela cheia; query opcional `?type=`) · `/lapso` Lapso (query `?type=&from=sos`) · `/caixa` Problemas evitados ·
`/revisao` Revisões (query `?tipo=semanal`) · `/progresso` · `/base` Sono e exercício · `/ajuda` Ajuda & segurança · `/ajustes` · `/inicio` Onboarding (fora do shell) · Lock (tela de PIN).

## Mundo visual (contrato — não negociável)
Carta náutica em paleta ECDIS Dia/Noite. Leia `.impeccable/surfaces/src-app-tsx.md`.
- Cores só pelos tokens: `bg-paper / paper-2 / paper-3`, `bg-shoal / shoal-2 / shoal-3`, `text-ink / ink-2 / ink-3`, `border-rule / rule-2`, `text-sea`, `magenta` (acento ÚNICO: SOS, ação primária, marcação ativa), `go` (confirmação), `light` (atenção não punitiva), `land` (campos pequenos). Nada de hex solto, nada de vermelho, nada de gradiente decorativo, nada de glassmorphism.
- Tipografia: Archivo variável. Classes: `t-display` (títulos grandes, expandido), `t-title`, `t-label` (rótulos de dado condensados caixa alta — NUNCA como "eyebrow" acima de título), `t-plan` (itálico para planos se-então e frases de autocompaixão), `t-num` (algarismos tabulares), `t-cond`.
- Composição: réguas de 1px (`border-rule`) separam; NÃO use cards com sombra, não aninhe caixas, não faça grade de cards ícone+título+texto, não use números de seção 01/02/03, não use border-left colorido > 1px, não use emoji nem caracteres unicode como ícone. Ícones: só os símbolos de carta em `src/components/marks/Marks.tsx` (pode adicionar novos símbolos de carta no SEU arquivo, mesmo traço 1.5/grade 20).
- Primitivos prontos em `src/components/ui/`: `Button` (variants primary=magenta, ink, secondary, quiet, go; sizes sm/md/lg), `TextField`, `TextArea`, `IfThenField` (+`splitIfThen`), `Scale` (0–10 em células; `tone="magenta"` para intensidade), `Segmented`, `Check`, `Chip`, `Flow`/`FlowQuestion`/`FlowProgress` (uma decisão por tela), `Page`, `ScreenHeader`, `Section`, `Empty`, `Reading`, `Sheet` (confirmações), `toast('Registrado.')`, `SlidingNumber` (dígitos que viram). Use-os; estenda via className.
- Movimento: `motion` com ease `[0.16, 1, 0.3, 1]`, partindo de estado visível; reordenações com `layout` (a linha muda de lugar e segura um realce até ser vista). Um momento autoral por tela, não efeitos espalhados. Respeite reduced motion (o `MotionConfig` já está em `reducedMotion="user"`).
- Responsivo: tem de funcionar em 360px (Android), 390px (iPhone, com safe-area) e notebook 1280–1600. Alvos de toque ≥ 44px. No celular, o shell tem barra inferior fixa de 64px + safe-area: `Page` já dá `pb-32`. Telas de tela cheia (`/foco`, `/sos`, `/inicio`) usam `min-h-dvh`, `safe-t`/`safe-b`.
- Estados: vazio, carregando, erro, desabilitado, foco de teclado — todos desenhados.

## Linguagem (pt-BR)
Tom gentil, direto, sem moralismo. "Lapso", nunca "fracasso/recaída/falha". Sem streaks que zeram, sem pontos, sem rankings, sem vermelho punitivo, sem emojis tristes. Controles nomeiam a ação ("Começar bloco de 12 min"). Textos curtos: o usuário tem TDAH — uma decisão por tela nos fluxos. Não invente estatísticas, depoimentos ou promessas de cura. Evidência citada só como está no documento-fonte (ex.: "planos se-então: d = 0,65 em 94 testes").

## Qualidade
- `npx tsc --noEmit -p .` precisa passar sem erros ao final (rode no fim do seu trabalho; corrija só erros nos SEUS arquivos).
- Sem `any` desnecessário, sem código morto, sem comentários óbvios. Comentários em pt-BR, raros.
- O servidor de dev já roda em http://localhost:5180 — não inicie outro. Não rode `npm install` sem necessidade; se precisar de uma dependência, justifique no relatório.
- Ao terminar, responda com: arquivos criados/alterados, o que cada tela faz, decisões e qualquer pendência.
