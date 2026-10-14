"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { DecideResult } from "@/lib/tmdb";

type Item = NonNullable<DecideResult["item"]>;

// "2h 13min", "47min", ou null se a TMDB não tem a duração.
function formatRuntime(min: number | null, type: Item["type"]): string | null {
  if (!min || min <= 0) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  const base = h > 0 ? (m > 0 ? `${h}h ${m}min` : `${h}h`) : `${m}min`;
  return type === "tv" ? `~${base}/ep.` : base;
}

// Linha de metadados: ano · tipo · duração · nota · país(es) de origem.
function MetaLine({ item }: { item: Item }) {
  const runtime = formatRuntime(item.runtimeMinutes, item.type);
  const countryLabel = item.countries
    .slice(0, 2)
    .map((c) => `${c.flag} ${c.name}`)
    .join(" · ");

  const parts: { key: string; node: React.ReactNode }[] = [];
  if (item.year) parts.push({ key: "year", node: item.year });
  parts.push({ key: "type", node: item.type === "movie" ? "Filme" : "Série" });
  if (runtime) parts.push({ key: "runtime", node: runtime });
  if (item.rating > 0)
    parts.push({
      key: "rating",
      node: <span className="text-ember">★ {item.rating.toFixed(1)}</span>,
    });
  if (countryLabel) parts.push({ key: "country", node: countryLabel });

  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-cream-dim">
      {parts.map((p, i) => (
        <span key={p.key} className="flex items-center gap-3">
          {i > 0 && <span className="text-cream/20">·</span>}
          {p.node}
        </span>
      ))}
    </p>
  );
}

function ProviderRow({ item }: { item: Item }) {
  const flatrate = item.providers?.flatrate ?? [];
  const rent = item.providers?.rent ?? [];
  const buy = item.providers?.buy ?? [];

  // Prioriza streaming por assinatura; cai pra aluguel/compra se for o caso.
  const list = flatrate.length ? flatrate : rent.length ? rent : buy;
  const label = flatrate.length
    ? "Disponível em"
    : rent.length
      ? "Para alugar em"
      : buy.length
        ? "Para comprar em"
        : null;

  if (!list.length) {
    return (
      <p className="text-sm text-cream-dim">
        Sem streaming listado no Brasil agora — talvez esteja num catálogo
        físico ou fora do ar por aqui.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-3 text-xs uppercase tracking-[0.18em] text-cream-dim">
        {label}
      </p>
      <div className="flex flex-wrap gap-2.5">
        {list.slice(0, 6).map((p) => (
          <div
            key={p.provider_id}
            title={p.provider_name}
            className="flex items-center gap-2 rounded-xl border border-cream/10 bg-ink/60 px-2.5 py-1.5"
          >
            {p.logo_path && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
                alt=""
                width={24}
                height={24}
                className="h-6 w-6 rounded-md"
              />
            )}
            <span className="text-sm text-cream">{p.provider_name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ResultCard({
  item,
  onAgain,
  onRestart,
  deciding,
}: {
  item: Item;
  onAgain: () => void;
  onRestart: () => void;
  deciding: boolean;
}) {
  return (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-3xl"
    >
      <p className="mb-6 text-center text-sm uppercase tracking-[0.2em] text-cream-dim">
        Decidi. Hoje você vê…
      </p>

      <div className="overflow-hidden rounded-3xl border border-cream/10 bg-ink-soft/80 shadow-ember backdrop-blur-sm sm:flex">
        {/* Pôster */}
        <div className="relative aspect-[2/3] w-full shrink-0 bg-ink sm:w-[280px]">
          {item.posterUrl ? (
            <Image
              src={item.posterUrl}
              alt={`Pôster de ${item.title}`}
              fill
              sizes="(max-width: 640px) 100vw, 280px"
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center font-serif text-cream-dim">
              {item.title}
            </div>
          )}
        </div>

        {/* Detalhes */}
        <div className="flex flex-col gap-5 p-7 sm:p-8">
          <div>
            <h2 className="font-serif text-3xl leading-tight text-cream text-glow">
              {item.title}
            </h2>
            <MetaLine item={item} />
          </div>

          <p className="text-[15px] leading-relaxed text-cream/85">
            {item.overview || "Esse título não tem sinopse em português por aqui — mas confia, eu escolhi."}
          </p>

          <ProviderRow item={item} />

          <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={onAgain}
              disabled={deciding}
              className="focus-ember rounded-full bg-ember px-6 py-3 text-sm font-medium text-ink transition-all duration-300 hover:bg-ember-deep hover:shadow-ember disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deciding ? "Escolhendo…" : "Decide de novo"}
            </button>
            <button
              onClick={onRestart}
              className="focus-ember rounded-full px-5 py-3 text-sm text-cream-dim transition-colors hover:text-cream"
            >
              Recomeçar
            </button>
          </div>
        </div>
      </div>

      {/* Crédito exigido pela TMDB ao exibir dados de disponibilidade. */}
      <p className="mt-4 text-center text-xs text-cream-dim/70">
        Disponibilidade via JustWatch · Dados por TMDB
      </p>
    </motion.div>
  );
}
