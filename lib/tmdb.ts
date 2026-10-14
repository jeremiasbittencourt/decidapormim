// Camada de acesso à TMDB — roda SEMPRE no servidor.
// A chave nunca é exposta ao cliente.

const BASE = "https://api.themoviedb.org/3";

// Região padrão para "onde assistir" e disponibilidade.
export const REGION = "BR";
export const LANG = "pt-BR";

// A TMDB não deixa pedir além da página 500 via /discover.
const MAX_TMDB_PAGE = 500;

export type MediaType = "movie" | "tv";

export interface Genre {
  id: number;
  name: string;
}

export interface DiscoverItem {
  id: number;
  // /discover/movie usa `title`; /discover/tv usa `name`.
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  original_language?: string;
  release_date?: string; // movie
  first_air_date?: string; // tv
}

interface DiscoverResponse {
  page: number;
  total_pages: number;
  total_results: number;
  results: DiscoverItem[];
}

export interface Provider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
}

export interface WatchProviders {
  link?: string;
  flatrate?: Provider[]; // assinatura (streaming)
  rent?: Provider[];
  buy?: Provider[];
}

/** Lê as credenciais do ambiente. Aceita bearer token v4 (preferido) ou api_key v3. */
function getAuth(): { headers: Record<string, string>; query: Record<string, string> } {
  const bearer = process.env.TMDB_READ_ACCESS_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;

  if (bearer) {
    return { headers: { Authorization: `Bearer ${bearer}` }, query: {} };
  }
  if (apiKey) {
    return { headers: {}, query: { api_key: apiKey } };
  }
  throw new Error(
    "TMDB sem credenciais. Defina TMDB_READ_ACCESS_TOKEN (v4) ou TMDB_API_KEY (v3) no .env.local."
  );
}

async function tmdbFetch<T>(
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T> {
  const { headers, query } = getAuth();
  const url = new URL(`${BASE}${path}`);

  for (const [key, value] of Object.entries({ ...query, ...params })) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url.toString(), {
    headers: { accept: "application/json", ...headers },
    // Gêneros mudam raramente; cacheamos por 24h. Discover é sempre fresco (sorteio).
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TMDB ${res.status} em ${path}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// A TMDB não localiza para pt-BR os gêneros exclusivos de TV. Traduzimos na mão.
const GENRE_PT_OVERRIDE: Record<number, string> = {
  10759: "Ação e Aventura",
  10762: "Infantil",
  10763: "Notícias",
  10764: "Reality Show",
  10765: "Ficção Científica e Fantasia",
  10766: "Novela",
  10767: "Talk Show",
  10768: "Guerra e Política",
};

/** Lista de gêneros disponíveis para filme ou série. */
export async function getGenres(type: MediaType): Promise<Genre[]> {
  const data = await tmdbFetch<{ genres: Genre[] }>(`/genre/${type}/list`, {
    language: LANG,
  });
  return data.genres.map((g) => ({
    ...g,
    name: GENRE_PT_OVERRIDE[g.id] ?? g.name,
  }));
}

interface DiscoverFilters {
  type: MediaType;
  genreId: number;
  yearFrom: number;
  yearTo: number;
  page?: number;
}

// Piso de nota para os sorteios "de prestígio".
const HIGH_RATING = 7.5;

function buildDiscoverParams(
  f: DiscoverFilters,
  minRating?: number
): Record<string, string | number> {
  const dateField =
    f.type === "movie" ? "primary_release_date" : "first_air_date";
  const params: Record<string, string | number> = {
    language: LANG,
    region: REGION,
    with_genres: f.genreId,
    [`${dateField}.gte`]: `${f.yearFrom}-01-01`,
    [`${dateField}.lte`]: `${f.yearTo}-12-31`,
    sort_by: "popularity.desc",
    include_adult: "false",
    // Evita títulos sem nenhum voto (qualidade mínima do sorteio).
    "vote_count.gte": 20,
    page: f.page ?? 1,
    watch_region: REGION,
  };
  if (minRating) {
    params["vote_average.gte"] = minRating;
    // Com nota alta, exigimos uma amostra de votos maior pra a média ser confiável.
    params["vote_count.gte"] = 100;
  }
  return params;
}

async function discover(
  f: DiscoverFilters,
  minRating?: number
): Promise<DiscoverResponse> {
  return tmdbFetch<DiscoverResponse>(
    `/discover/${f.type}`,
    buildDiscoverParams(f, minRating)
  );
}

export interface Country {
  code: string;
  name: string;
  flag: string;
}

interface DetailsResponse {
  overview?: string;
  runtime?: number | null; // filmes (minutos)
  episode_run_time?: number[]; // séries (minutos por episódio)
  last_episode_to_air?: { runtime?: number | null } | null;
  origin_country?: string[];
  production_countries?: { iso_3166_1: string; name: string }[];
}

interface Details {
  overview: string;
  runtimeMinutes: number | null;
  countries: Country[];
}

// Nome do país em pt-BR sem precisar de tabela manual.
const ptRegionNames = new Intl.DisplayNames(["pt-BR"], { type: "region" });

function countryName(code: string): string {
  try {
    return ptRegionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

// Bandeira emoji a partir do código ISO 3166-1 alpha-2.
function countryFlag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "";
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

function toCountries(codes: string[]): Country[] {
  return codes
    .filter((c) => /^[A-Za-z]{2}$/.test(c))
    .map((code) => ({
      code: code.toUpperCase(),
      name: countryName(code),
      flag: countryFlag(code),
    }));
}

/**
 * Detalhes do título: sinopse (pt-BR, com fallback pro idioma original e depois
 * inglês), duração (do filme ou por episódio) e país(es) de origem.
 */
async function getDetails(
  type: MediaType,
  id: number,
  originalLanguage?: string
): Promise<Details> {
  let overview = "";
  let runtimeMinutes: number | null = null;
  let countries: Country[] = [];

  try {
    const pt = await tmdbFetch<DetailsResponse>(`/${type}/${id}`, {
      language: LANG,
    });
    overview = pt.overview ?? "";

    runtimeMinutes =
      type === "movie"
        ? (pt.runtime ?? null)
        : (pt.episode_run_time?.[0] ??
          pt.last_episode_to_air?.runtime ??
          null);
    if (runtimeMinutes === 0) runtimeMinutes = null;

    const codes =
      pt.origin_country && pt.origin_country.length
        ? pt.origin_country
        : (pt.production_countries?.map((c) => c.iso_3166_1) ?? []);
    countries = toCountries(codes);
  } catch {
    // segue com o que tiver
  }

  // Fallback de sinopse: idioma original → inglês.
  if (!overview) {
    try {
      if (originalLanguage && originalLanguage !== "pt") {
        const orig = await tmdbFetch<DetailsResponse>(`/${type}/${id}`, {
          language: originalLanguage,
        });
        overview = orig.overview ?? "";
      }
      if (!overview) {
        const en = await tmdbFetch<DetailsResponse>(`/${type}/${id}`, {
          language: "en-US",
        });
        overview = en.overview ?? "";
      }
    } catch {
      // sem sinopse — a UI tem um texto de reserva
    }
  }

  return { overview, runtimeMinutes, countries };
}

/** Providers de streaming/aluguel para a região padrão. */
export async function getWatchProviders(
  type: MediaType,
  id: number
): Promise<WatchProviders | null> {
  const data = await tmdbFetch<{
    results: Record<string, WatchProviders>;
  }>(`/${type}/${id}/watch/providers`);
  return data.results?.[REGION] ?? null;
}

export interface DecideResult {
  status: "ok" | "exhausted" | "empty";
  item?: {
    id: number;
    type: MediaType;
    title: string;
    overview: string;
    posterUrl: string | null;
    backdropUrl: string | null;
    year: string | null;
    rating: number;
    runtimeMinutes: number | null;
    countries: Country[];
    providers: WatchProviders | null;
    tmdbUrl: string;
  };
}

const IMG = (size: string, path: string | null) =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null;

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

type PickOutcome =
  | { kind: "found"; item: DiscoverItem }
  | { kind: "empty" } // o catálogo filtrado não tem NADA
  | { kind: "none" }; // tem catálogo, mas nada de novo (ou nada com a nota pedida)

/**
 * Sorteia um item dentro dos filtros:
 *  1. pede a página 1 só pra saber quantas páginas existem
 *  2. sorteia uma página aleatória (respeitando o teto de 500 da TMDB)
 *  3. sorteia um item dela que não esteja no Set de já vistos
 *  4. se a página sorteada estiver toda excluída, tenta outras páginas
 */
async function pickFromCatalog(
  filters: Omit<DiscoverFilters, "page">,
  exclude: Set<number>,
  minRating?: number
): Promise<PickOutcome> {
  const first = await discover({ ...filters, page: 1 }, minRating);
  if (first.total_results === 0) {
    return { kind: "empty" };
  }

  const maxPage = Math.min(first.total_pages, MAX_TMDB_PAGE);
  const attempts = Math.min(maxPage, 8);
  const triedPages = new Set<number>();

  for (let i = 0; i < attempts; i++) {
    let page: number;
    if (i === 0 && maxPage <= 3) {
      page = 1; // catálogo pequeno: começa pela página que já temos
    } else {
      do {
        page = Math.floor(Math.random() * maxPage) + 1;
      } while (triedPages.has(page) && triedPages.size < maxPage);
    }
    triedPages.add(page);

    const data = page === 1 ? first : await discover({ ...filters, page }, minRating);
    const candidates = data.results.filter(
      (item) => !exclude.has(item.id) && (item.poster_path || item.overview)
    );

    if (candidates.length > 0) {
      return { kind: "found", item: pickRandom(candidates) };
    }
  }

  return { kind: "none" };
}

/**
 * Sorteio principal, com cadência de notas: as escolhas seguem o padrão
 * alta · alta · qualquer · alta · alta · qualquer … conforme o nº de títulos
 * já mostrados na sessão (`excludeIds.length`). Se o pote de nota alta estiver
 * vazio, relaxa o filtro em vez de declarar esgotado. No fim, resolve a sinopse
 * (com fallback pro idioma original) e os providers do título escolhido.
 */
export async function decide(
  filters: Omit<DiscoverFilters, "page">,
  excludeIds: number[]
): Promise<DecideResult> {
  const exclude = new Set(excludeIds);

  // A cada 3 sorteios, o terceiro abre mão do piso de nota.
  const wantHighRated = excludeIds.length % 3 !== 2;

  let outcome = await pickFromCatalog(
    filters,
    exclude,
    wantHighRated ? HIGH_RATING : undefined
  );

  // Sem opções com nota alta o suficiente → cai pro catálogo geral.
  if (outcome.kind !== "found" && wantHighRated) {
    outcome = await pickFromCatalog(filters, exclude, undefined);
  }

  if (outcome.kind === "empty") return { status: "empty" };
  if (outcome.kind === "none") return { status: "exhausted" };

  const chosen = outcome.item;

  // Detalhes (duração, país, sinopse) e providers em paralelo.
  const [details, providers] = await Promise.all([
    getDetails(filters.type, chosen.id, chosen.original_language),
    getWatchProviders(filters.type, chosen.id).catch(() => null),
  ]);

  const date = chosen.release_date || chosen.first_air_date || "";

  return {
    status: "ok",
    item: {
      id: chosen.id,
      type: filters.type,
      title: chosen.title || chosen.name || "Sem título",
      overview: chosen.overview || details.overview,
      posterUrl: IMG("w500", chosen.poster_path),
      backdropUrl: IMG("w780", chosen.backdrop_path),
      year: date ? date.slice(0, 4) : null,
      rating: chosen.vote_average,
      runtimeMinutes: details.runtimeMinutes,
      countries: details.countries,
      providers,
      tmdbUrl: `https://www.themoviedb.org/${filters.type}/${chosen.id}`,
    },
  };
}
