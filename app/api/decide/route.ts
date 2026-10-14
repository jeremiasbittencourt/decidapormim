import { NextRequest, NextResponse } from "next/server";
import { decide, type MediaType } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

function parseExclude(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type");
  const genreId = Number(sp.get("genre"));
  const yearFrom = Number(sp.get("from"));
  const yearTo = Number(sp.get("to"));

  if (type !== "movie" && type !== "tv") {
    return NextResponse.json(
      { error: "Parâmetro 'type' deve ser 'movie' ou 'tv'." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(genreId) || genreId <= 0) {
    return NextResponse.json({ error: "Parâmetro 'genre' inválido." }, { status: 400 });
  }
  if (!Number.isFinite(yearFrom) || !Number.isFinite(yearTo)) {
    return NextResponse.json({ error: "Faixa de anos inválida." }, { status: 400 });
  }

  const excludeIds = parseExclude(sp.get("exclude"));

  try {
    const result = await decide(
      { type: type as MediaType, genreId, yearFrom, yearTo },
      excludeIds
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
