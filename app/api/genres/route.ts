import { NextRequest, NextResponse } from "next/server";
import { getGenres, type MediaType } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  if (type !== "movie" && type !== "tv") {
    return NextResponse.json(
      { error: "Parâmetro 'type' deve ser 'movie' ou 'tv'." },
      { status: 400 }
    );
  }

  try {
    const genres = await getGenres(type as MediaType);
    return NextResponse.json({ genres });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
