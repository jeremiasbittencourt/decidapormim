# Arquitetura & Manutenção — Decida Por Mim

Este documento explica **como o projeto funciona por dentro**: o que cada pasta e
arquivo faz, como os dados fluem da TMDB até a tela, e como fazer as manutenções
mais comuns sem quebrar nada. Se você nunca mexeu no projeto, leia da seção
[Visão geral](#1-visão-geral) até [Fluxo de uma sessão](#4-fluxo-de-uma-sessão-passo-a-passo).
Se já conhece e só quer alterar algo, vá direto para [Como dar manutenção](#7-como-dar-manutenção).

---

## 1. Visão geral

**Decida Por Mim** é um app **Next.js 14 (App Router)** em **TypeScript**, estilizado
com **Tailwind CSS** e animado com **Framer Motion**. Ele faz três perguntas ao
usuário (filme ou série → gênero → época) e sorteia um título da **API da TMDB**
dentro desses critérios.

A ideia central de arquitetura é uma só:

> **Tudo que toca a TMDB roda no servidor. O navegador nunca vê a chave de API.**

O navegador (cliente) cuida da interface e do estado da sessão (o que já foi
mostrado). Quando precisa de dados, ele chama **rotas internas** do próprio app
(`/api/...`), e são essas rotas — rodando no servidor Node do Next — que conversam
com a TMDB usando a chave secreta.

```
┌─────────────┐   fetch /api/...   ┌──────────────────┐   fetch + chave   ┌────────┐
│  NAVEGADOR  │ ─────────────────► │  SERVIDOR (Next)  │ ────────────────► │  TMDB  │
│  (cliente)  │ ◄───────────────── │  route handlers   │ ◄──────────────── │        │
└─────────────┘    JSON limpo      └──────────────────┘    JSON cru        └────────┘
   React/UI          (sem chave)        lib/tmdb.ts         (com chave)
```

---

## 2. Mapa de pastas e arquivos

```
decidapormim/
├── app/                     ← tudo que o Next serve (App Router)
│   ├── layout.tsx           ← "moldura" de toda página: fontes + <html>/<body>
│   ├── page.tsx             ← a aplicação em si: máquina de estados do fluxo
│   ├── globals.css          ← estilos globais: fundo, halo, vinheta, utilitários
│   └── api/                 ← endpoints internos (rodam no SERVIDOR)
│       ├── genres/route.ts  ←   GET /api/genres?type=movie|tv
│       └── decide/route.ts  ←   GET /api/decide?type=&genre=&from=&to=&exclude=
│
├── components/              ← peças visuais reutilizáveis (rodam no CLIENTE)
│   ├── QuestionScreen.tsx   ← tela genérica de pergunta (título + opções)
│   ├── ResultCard.tsx       ← o card do título sorteado
│   └── Dots.tsx             ← os três pontinhos de progresso
│
├── lib/                     ← lógica pura, sem React
│   ├── tmdb.ts              ← TODA a conversa com a TMDB + algoritmo de sorteio
│   └── eras.ts              ← as faixas de época (Clássicos, Era de Ouro, …)
│
├── .env.local               ← SUA chave da TMDB (não vai pro git)
├── .env.example             ← modelo do .env.local (vai pro git)
├── tailwind.config.ts       ← paleta de cores, fontes, sombras, animações
├── next.config.mjs          ← libera o domínio de imagens da TMDB
├── tsconfig.json            ← config do TypeScript (inclui o atalho "@/")
├── README.md                ← como rodar e conseguir a chave
└── ARQUITETURA.md           ← este arquivo
```

Regra mental rápida: **`app/` e `components/` são a casa; `lib/` é a cozinha; `api/`
é a porta dos fundos por onde os dados entram.**

---

## 3. Os três conceitos do Next que você precisa entender

O projeto usa só três recursos do Next. Entendendo estes, o resto é React normal.

### 3.1 App Router: pasta = rota

No App Router, **a estrutura de pastas dentro de `app/` vira as URLs**.
- `app/page.tsx` → a página inicial (`/`)
- `app/api/genres/route.ts` → o endpoint `/api/genres`
- `app/api/decide/route.ts` → o endpoint `/api/decide`

`page.tsx` é uma **página** (devolve interface). `route.ts` é um **route handler**
(devolve dados, tipo JSON). Os dois nomes são especiais e reservados pelo Next.

### 3.2 Server vs. Client Components

Por padrão, todo componente no App Router roda **no servidor**. Para rodar no
navegador (ter `useState`, `onClick`, animação), o arquivo precisa começar com a
diretiva:

```tsx
"use client";
```

Repare: `app/page.tsx` e tudo em `components/` têm `"use client"` no topo, porque
são interativos. Já os `route.ts` e o `lib/tmdb.ts` **não têm** — rodam no servidor,
que é o único lugar onde a chave da TMDB existe.

> **Por que isso importa para manutenção:** se você importar `lib/tmdb.ts` dentro de
> um componente com `"use client"`, o Next vai tentar mandar esse código (e a chave!)
> pro navegador e dará erro. A regra é: **o cliente fala com `/api/...`, nunca com
> `lib/tmdb.ts` direto.**

### 3.3 As variáveis de ambiente

A chave fica em `.env.local` como `TMDB_READ_ACCESS_TOKEN`. Como o nome **não** começa
com `NEXT_PUBLIC_`, o Next só a expõe no servidor — exatamente o que queremos. O
`lib/tmdb.ts` lê `process.env.TMDB_READ_ACCESS_TOKEN`. Se mudar o `.env.local`, o
servidor de dev recarrega sozinho.

---

## 4. Fluxo de uma sessão, passo a passo

Acompanhe o que acontece quando alguém usa o site. O cérebro de tudo é
[`app/page.tsx`](app/page.tsx), que é uma **máquina de estados**: ele guarda em qual
"passo" o usuário está e troca a tela conforme avança.

```
landing ──► type ──► genre ──► era ──► result
 (frase)  (filme/  (gênero) (época) (título
          série)                     sorteado)
```

O estado vive em `useState` dentro de `page.tsx`:

| Estado | O que guarda |
|---|---|
| `step` | em qual tela estamos (`"landing" | "type" | "genre" | "era" | "result"`) |
| `type` | `"movie"` ou `"tv"` |
| `genres` | a lista de gêneros que veio da API (para o passo "genre") |
| `genre` | o gênero escolhido |
| `era` | a faixa de época escolhida |
| `result` | a resposta do `/api/decide` (o título sorteado, ou "esgotado") |
| `seen` | **a lista de IDs já mostrados** — é o "não repetir" da sessão |
| `deciding` | `true` enquanto espera o sorteio (mostra "deixa eu pensar…") |

E o passo a passo concreto:

1. **Landing** — o componente `Landing` mostra a frase-herói e o botão "Começar".
   Clicar muda `step` para `"type"`.

2. **Filme ou série** — `QuestionScreen` mostra as duas opções. Ao escolher, o
   `handleType` faz `fetch("/api/genres?type=...")`, guarda a lista em `genres` e
   muda para `step = "genre"`.

3. **Gênero** — `GenreStep` mostra a lista de `genres` como opções (ou um "folheando
   os gêneros…" enquanto carrega). Ao escolher, guarda o `genre` e vai para `"era"`.

4. **Época** — `QuestionScreen` com as faixas de `lib/eras.ts`. Ao escolher, chama
   `runDecideWith(era)` e vai para `"result"`.

5. **Resultado** — `runDecideWith` faz `fetch("/api/decide?...")`. Enquanto espera,
   mostra `<Deciding />`. Quando chega:
   - **status `"ok"`** → `<ResultCard />` com pôster, sinopse, duração, país, onde
     assistir. O ID entra em `seen`.
   - **status `"exhausted"` / `"empty"`** → mensagem elegante com botão "Trocar gênero".

6. **Decide de novo** — o botão chama `runDecide(seen)`, que repete o sorteio
   **passando a lista `seen`** para a API excluir o que já foi visto. O novo ID
   também entra em `seen`.

> **Curiosidade de implementação:** existem duas funções de sorteio quase iguais —
> `runDecideWith(era)` e `runDecide(excludeIds)`. A primeira é usada no **primeiro**
> sorteio porque, no instante do clique, o estado `era` ainda não "propagou" no React;
> então passamos a era escolhida direto por parâmetro. A segunda é usada no "decide
> de novo", quando todo o estado já está estável. Funcionalmente fazem o mesmo fetch.

---

## 5. O coração: `lib/tmdb.ts`

Este é o arquivo mais importante para entender o comportamento do app. Ele é puro
TypeScript de servidor (sem React) e tem quatro responsabilidades.

### 5.1 Autenticação e o `fetch` base

`getAuth()` lê a chave do ambiente. Aceita **duas formas**:
- `TMDB_READ_ACCESS_TOKEN` (token v4, recomendado) → vai no header `Authorization: Bearer ...`
- `TMDB_API_KEY` (chave v3 clássica) → vai como `?api_key=...` na URL

`tmdbFetch()` é o único lugar que realmente chama a TMDB. Ele monta a URL, junta os
parâmetros, anexa a autenticação e trata erro. Tudo passa por aqui — então se você
quiser logar chamadas, mudar cache, etc., é **um só lugar**.

### 5.2 Gêneros — `getGenres(type)`

Busca `/genre/{movie|tv}/list` em pt-BR. **Detalhe importante:** a TMDB não traduz os
gêneros exclusivos de série (Action & Adventure, Kids, etc.), então existe o mapa
`GENRE_PT_OVERRIDE` que corrige esses nomes na mão. Para adicionar/ajustar uma
tradução, edite esse objeto.

### 5.3 Detalhes — `getDetails(type, id)`

Depois de sortear um título, buscamos seus detalhes em `/{type}/{id}`. De lá saem
**três coisas**:
- **Sinopse** em pt-BR. Se não houver, cai para o **idioma original** e, por fim, inglês.
- **Duração:** filme usa `runtime` (minutos). Série usa `episode_run_time[0]`
  (minutos por episódio), com `last_episode_to_air.runtime` como reserva.
- **País(es) de origem:** dos campos `origin_country` / `production_countries`. O nome
  é traduzido para pt-BR com `Intl.DisplayNames` (recurso nativo do JS, sem tabela
  manual) e a bandeira é o emoji derivado do código ISO do país.

### 5.4 Providers — `getWatchProviders(type, id)`

Busca `/{type}/{id}/watch/providers` e devolve a parte da região **BR** (`flatrate`
= streaming por assinatura, `rent` = aluguel, `buy` = compra). O `ResultCard` mostra
o streaming; se não houver, mostra aluguel; se não houver, compra.

### 5.5 O algoritmo de sorteio — `decide(filters, excludeIds)`

Esta é a função mais sofisticada. Ela faz, em ordem:

**a) Cadência de notas.** A cada três sorteios da sessão, dois exigem nota alta
(≥ `HIGH_RATING`, hoje **7.5**) e o terceiro libera qualquer nota. A posição é
calculada por `excludeIds.length % 3 !== 2` — ou seja, depende de **quantos títulos
já foram mostrados**:

| Sorteio | `excludeIds.length` | `% 3` | Exige nota alta? |
|:-:|:-:|:-:|:-:|
| 1º | 0 | 0 | ✅ sim |
| 2º | 1 | 1 | ✅ sim |
| 3º | 2 | 2 | ❌ qualquer nota |
| 4º | 3 | 0 | ✅ sim |
| 5º | 4 | 1 | ✅ sim |
| 6º | 5 | 2 | ❌ qualquer nota |

**b) Sorteio dentro do catálogo** (`pickFromCatalog`):
1. Pede a **página 1** do `/discover` só para descobrir quantas páginas existem.
2. **Sorteia uma página aleatória** (respeitando o teto de 500 páginas da TMDB).
3. **Sorteia um item** dela que **não esteja** no Set de já vistos (`excludeIds`).
4. Se a página caiu toda em itens já vistos, tenta outras páginas (até 8 tentativas).

**c) Fallback de nota.** Se o pote de "nota alta" não tiver nada novo, ele
**relaxa o filtro** e tenta de novo no catálogo geral — em vez de dizer "esgotado"
cedo demais.

**d) Resultado.** Com o título escolhido, busca detalhes e providers **em paralelo**
(`Promise.all`) e monta o objeto final que a interface consome.

Os três status possíveis:
- `"ok"` → achou um título (vem no campo `item`).
- `"empty"` → a combinação de filtros não tem **nada** na TMDB.
- `"exhausted"` → tem catálogo, mas **tudo já foi mostrado** nesta sessão.

---

## 6. As peças visuais (`components/` + `globals.css`)

- **[`QuestionScreen.tsx`](components/QuestionScreen.tsx)** — tela genérica de pergunta.
  Recebe um `kicker` (texto pequeno em cima), a `question` (título grande), uma lista
  de `choices` e o callback `onSelect`. As opções aparecem em **stagger** (uma depois
  da outra). É reutilizada nos passos "filme/série", "gênero" e "época".

- **[`ResultCard.tsx`](components/ResultCard.tsx)** — o card do resultado. Tem três
  sub-peças internas: `MetaLine` (a linha *ano · tipo · duração · ★nota · país*),
  `ProviderRow` (onde assistir) e o `formatRuntime` (transforma minutos em "2h 13min"
  ou "~54min/ep."). No rodapé fica o crédito **"Disponibilidade via JustWatch"**,
  **exigido pela TMDB** — não remova.

- **[`Dots.tsx`](components/Dots.tsx)** — os três pontinhos de progresso no topo.

- **[`globals.css`](app/globals.css)** — define o "clima": o fundo `ink`, o **halo
  âmbar** no topo e a **vinheta** nas bordas (ambos via `radial-gradient` no `body`),
  e utilitários como `.text-glow` (texto que parece iluminado) e `.focus-ember`
  (anel de foco quente e acessível). Também respeita `prefers-reduced-motion`.

- **[`tailwind.config.ts`](tailwind.config.ts)** — a **fonte da verdade visual**:
  as cores (`ink`, `ember`, `cream`…), as fontes (`serif` = Fraunces, `sans` = Inter)
  e a sombra `shadow-ember`. Mudou aqui, mudou no site inteiro.

---

## 7. Como dar manutenção

Receitas para as mudanças mais prováveis. Em quase todas, **o servidor de dev
recarrega sozinho** ao salvar (`npm run dev`).

### ➤ Mudar uma cor / a "temperatura" do site
Edite [`tailwind.config.ts`](tailwind.config.ts) (objeto `colors`). O halo e a vinheta
do fundo estão em [`app/globals.css`](app/globals.css), no `background-image` do `body`.

### ➤ Trocar a fonte dos títulos
Em [`app/layout.tsx`](app/layout.tsx), troque o import `Fraunces` por outra fonte do
`next/font/google` e ajuste a `variable`. O Tailwind já aponta `font-serif` para essa
variável.

### ➤ Mudar/adicionar faixas de época
Edite o array `ERAS` em [`lib/eras.ts`](lib/eras.ts). Cada item tem `id`, `label`
(o que aparece), `hint` (a faixa de anos discreta), `from` e `to`. Não precisa mexer
em mais nada — a tela de época lê esse array direto.

### ➤ Ajustar o "rigor" das notas
Em [`lib/tmdb.ts`](lib/tmdb.ts):
- Mude a constante `HIGH_RATING` (hoje 7.5) para subir/baixar o piso de qualidade.
- Mude a regra da cadência (`excludeIds.length % 3 !== 2`) se quiser outra proporção.
  Por exemplo, `% 2 === 0` faria "alta · qualquer · alta · qualquer…".

### ➤ Corrigir/adicionar tradução de um gênero
Edite o mapa `GENRE_PT_OVERRIDE` em [`lib/tmdb.ts`](lib/tmdb.ts) (chave = id do gênero
na TMDB, valor = nome em pt-BR).

### ➤ Mudar a região (ex.: de BR para PT)
Em [`lib/tmdb.ts`](lib/tmdb.ts), as constantes `REGION` e `LANG` no topo controlam
idioma e país de "onde assistir". O `Intl.DisplayNames` dos países também usa pt-BR.

### ➤ Adicionar um campo novo ao resultado (ex.: elenco, trailer)
Isto cruza três arquivos, **nesta ordem**:
1. **`lib/tmdb.ts`** — busque o dado novo (em `getDetails` ou numa função nova) e
   adicione o campo ao objeto `item` **e** ao tipo `DecideResult`.
2. **`components/ResultCard.tsx`** — exiba o novo campo.
3. Pronto — a rota `/api/decide` já repassa o objeto inteiro, não precisa mudar.

### ➤ Adicionar uma pergunta nova no fluxo
1. Acrescente o passo ao tipo `Step` e ao `STEP_INDEX` em [`app/page.tsx`](app/page.tsx).
2. Adicione o `useState` para guardar a resposta.
3. Renderize mais um `<QuestionScreen />` dentro do `<AnimatePresence>`.
4. Inclua o novo filtro na chamada ao `/api/decide` e, no servidor, no `/discover`.

### ➤ Mudar o cache da TMDB
Em `tmdbFetch` (em [`lib/tmdb.ts`](lib/tmdb.ts)), a opção `next: { revalidate: ... }`
controla por quanto tempo o Next guarda a resposta. Gêneros podem ter cache longo;
o `/discover` é sempre fresco porque a URL muda a cada sorteio.

---

## 8. Comandos do dia a dia

```bash
npm run dev      # desenvolvimento, com recarga automática (http://localhost:3000)
npm run build    # build de produção — TAMBÉM checa todos os tipos do TypeScript
npm start        # roda o build de produção localmente
npm run lint     # checagem de estilo/erros do ESLint
```

**Dica de ouro:** rode `npm run build` antes de considerar uma mudança "pronta". Ele
não só gera o site como **roda o type-check em todo o projeto** — é a forma mais rápida
de descobrir se uma alteração quebrou algum tipo entre `lib/`, `api/` e os componentes.

---

## 9. Resolução de problemas

| Sintoma | Causa provável | Onde olhar |
|---|---|---|
| `/api/genres` retorna 502 "TMDB sem credenciais" | `.env.local` vazio ou nome errado da variável | [`.env.local`](.env.local) e `getAuth()` em `lib/tmdb.ts` |
| Erro "you're importing a component that needs useState…" | pôs `"use client"` faltando, ou importou `lib/tmdb` no cliente | topo do arquivo do componente |
| Pôster não carrega / erro de imagem | domínio não liberado | `images.remotePatterns` em [`next.config.mjs`](next.config.mjs) |
| Sempre cai em "Acabei minhas cartas" cedo demais | filtro de nota alta sem catálogo + combinação restrita | `HIGH_RATING` e `pickFromCatalog` em `lib/tmdb.ts` |
| Gênero de série em inglês | falta no mapa de tradução | `GENRE_PT_OVERRIDE` em `lib/tmdb.ts` |
| Mudei o `.env.local` e não pegou | servidor não recarregou | reinicie `npm run dev` |

---

## 10. Resumo em uma frase

> **`app/page.tsx`** comanda o fluxo no navegador e guarda o que já foi visto;
> quando precisa de dados, chama **`app/api/*`**, que no servidor usa
> **`lib/tmdb.ts`** (a chave mora só aqui) para falar com a TMDB, sortear com
> cadência de notas sem repetir, e devolver um objeto limpo que o
> **`components/ResultCard.tsx`** transforma no card final.
