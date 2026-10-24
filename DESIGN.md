# Rumo — Design

Documento derivado do código existente (`src/styles/index.css`, `docs/BUILD-BRIEF.md`, `.impeccable/surfaces/src-app-tsx.md`). Não define nada novo.

## Direção

Carta náutica em paleta ECDIS (IHO S-52), modos Dia e Noite (`data-chart='night'`, automático por horário ou fixado em Ajustes). Prioridades são waypoints; o bloco de foco é um quarto de vigia; o impulso é uma onda.

## Tokens (`src/styles/index.css`)

| Token | Uso |
|---|---|
| `paper`, `paper-2`, `paper-3` | fundo, painel, campo pressionado |
| `shoal`, `shoal-2`, `shoal-3` | águas rasas / isóbata, preenchimentos de dado |
| `ink`, `ink-2`, `ink-3` | texto primário, secundário, terciário |
| `rule`, `rule-2` | réguas de 1px |
| `sea` | dado principal |
| `magenta`, `magenta-ink`, `magenta-soft` | acento único: SOS, ação primária, marcação ativa |
| `go`, `go-soft` | confirmação |
| `light`, `light-soft` | atenção não punitiva |
| `land` | campos pequenos |

Sem hex solto, sem vermelho, sem gradiente decorativo, sem glassmorphism.

## Tipografia

Archivo Variable. `t-display` (títulos, expandido), `t-title`, `t-label` (rótulo de dado, condensado, caixa alta; nunca como eyebrow de título), `t-plan` (itálico: se-então e autocompaixão), `t-num` (tabular), `t-cond`.

## Composição

- Réguas de 1px separam; sem cards com sombra, sem caixas aninhadas, sem número de seção.
- Ícones: apenas os símbolos de carta de `components/marks/Marks.tsx`.
- Progresso como barra de escala alternada (`ScaleBar`, `FlowProgress`); moldura com `neatline` e `graticule` nas telas cheias (`MomentScreen`).
- Uma decisão por tela nos fluxos (`Flow`/`FlowQuestion`). Alvos de toque de 44px ou mais.
- Movimento: `motion` com ease `[0.16, 1, 0.3, 1]`; reduced motion pelo sistema ou por Ajustes.

## Telas

| Rota | Arquivo | Contêiner |
|---|---|---|
| `/` | `Today.tsx` | shell |
| `/checkin` | `CheckIn.tsx` | shell |
| `/foco` | `Focus.tsx` | tela cheia (`MomentScreen`) |
| `/sos` | `Sos.tsx` | tela cheia |
| `/lapso` | `Lapse.tsx` | shell, `Flow` de 8 etapas |
| `/caixa` | `Problems.tsx` | shell |
| `/revisao` | `Review.tsx` | shell |
| `/progresso` | `Progress.tsx` | shell |
| `/base` | `Base.tsx` | shell |
| `/ajuda` | `Help.tsx` | shell |
| `/ajustes` | `Settings.tsx` | shell |
| `/inicio` | `Onboarding.tsx` | tela cheia |

## Origem de componentes externos

`components/ui/sliding-number.tsx` vem de `design-kit/motion-primitives`. A leitura do dia por toque em `Progress.tsx` (faixa de dias dentro do plano) adapta a lógica do `Tracker` do Tremor, sem a dependência Radix e com os tokens do Rumo. Nenhum raster é entregue com o app além dos ícones PWA gerados por `scripts/icons.mjs`.

## Veredito da revisão técnica

- `tsc --noEmit`, `vitest run` (59 testes) e `npm run build` passam.
- A revisão visual por captura (`scripts/shots.mjs`) não rodou: o script esperou o redirecionamento da semente de demonstração e expirou em 20 s no servidor da porta 5180. As telas `Focus`, `Lapse`, `Progress` e `Settings` ainda não foram conferidas em 360, 390 e 1440 px.
