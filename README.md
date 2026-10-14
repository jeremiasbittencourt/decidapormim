# Decida Por Mim

> Quer ver algo mas não sabe o que assistir? Deixa que eu decido.

Um site que **escolhe um filme ou série pra você assistir** e elimina a paralisia
da escolha. Você responde três perguntas curtas — filme ou série, gênero, época —
e ele sorteia um título dentro dos seus critérios, mostrando pôster, sinopse e onde
assistir no Brasil. Não gostou? *Decide de novo* — e ele nunca repete o que já mostrou
na mesma sessão.

A sensação é de chegar em casa à noite, sentar no sofá e deixar alguém escolher por
você: penumbra quente, tipografia com personalidade, transições sem pressa.

---

## Como rodar

```bash
# 1. instalar dependências
npm install

# 2. configurar a chave da TMDB (veja a seção abaixo)
cp .env.example .env.local   # no Windows: copy .env.example .env.local
#   …e preencha TMDB_READ_ACCESS_TOKEN dentro de .env.local

# 3. subir o app
npm run dev
```

Abra <http://localhost:3000>.

---

## Como conseguir a chave da TMDB (é grátis)

1. Crie uma conta em <https://www.themoviedb.org/signup>.
2. Vá em **Settings → API** (<https://www.themoviedb.org/settings/api>).
3. Solicite uma chave de desenvolvedor (uso pessoal/educacional). É instantâneo.
4. Copie o **API Read Access Token** (o token longo, v4 / Bearer).
5. Cole em `.env.local`:

   ```env
   TMDB_READ_ACCESS_TOKEN=eyJhbGciOi...   # seu token aqui
   ```

> Prefere a chave v3 clássica? Use `TMDB_API_KEY=...` em vez do token — o app aceita
> qualquer uma das duas. O token v4 (Bearer) é o recomendado pela TMDB hoje.

A chave **nunca é exposta ao cliente**: todas as chamadas à TMDB acontecem em route
handlers no servidor (`app/api/*`). `.env.local` está no `.gitignore`.

---

## Como funciona o sorteio

1. Chama `/discover/{movie|tv}` com os filtros (gênero + faixa de anos), ordenado por
   popularidade e com um piso mínimo de votos pra garantir qualidade.
2. A TMDB devolve resultados paginados. O app **sorteia uma página aleatória**
   (respeitando o teto de 500 páginas da API) e depois **sorteia um item** dentro dela.
3. Os IDs já mostrados ficam num `Set` em memória da sessão (estado do React, sem banco).
4. *Decide de novo* sorteia excluindo esse `Set`. Se a categoria esgotar, o app avisa
   com elegância e oferece trocar de gênero.

---

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** — design tokens da paleta "Abajur às 22h"
- **Framer Motion** — transições e micro-interações
- **TMDB API** — gêneros, descoberta, detalhes e *watch providers*

### Estrutura

```
app/
  layout.tsx          fontes (Fraunces + Inter) e metadata
  page.tsx            máquina de estados do fluxo (landing → tipo → gênero → época → resultado)
  globals.css         halo âmbar, vinheta, tokens visuais
  api/
    genres/route.ts   GET /api/genres?type=movie|tv
    decide/route.ts   GET /api/decide?type=&genre=&from=&to=&exclude=
components/
  QuestionScreen.tsx  tela genérica de pergunta
  ResultCard.tsx      card do título sorteado + onde assistir
  Dots.tsx            progresso discreto
lib/
  tmdb.ts             camada server-side da TMDB + lógica de sorteio
  eras.ts             faixas de lançamento como categorias narrativas
```

---

## Créditos

Este produto usa a API da TMDB mas não é endossado nem certificado pela TMDB.
Os dados de **onde assistir** são fornecidos pelo **JustWatch** — crédito exibido no
card de resultado, conforme exigido pela TMDB.

<sub>This product uses the TMDB API but is not endorsed or certified by TMDB.</sub>
