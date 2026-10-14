"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { QuestionScreen, type Choice } from "@/components/QuestionScreen";
import { ResultCard } from "@/components/ResultCard";
import { Dots } from "@/components/Dots";
import { ERAS, type Era } from "@/lib/eras";
import type { DecideResult, Genre, MediaType } from "@/lib/tmdb";

type Step = "landing" | "type" | "genre" | "era" | "result";

const STEP_INDEX: Record<Exclude<Step, "landing">, number> = {
  type: 0,
  genre: 1,
  era: 2,
  result: 2,
};

const stageVariants = {
  enter: { opacity: 0, y: 14 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -14 },
};

export default function Home() {
  const [step, setStep] = useState<Step>("landing");
  const [type, setType] = useState<MediaType | null>(null);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [genre, setGenre] = useState<Genre | null>(null);
  const [era, setEra] = useState<Era | null>(null);

  const [result, setResult] = useState<DecideResult | null>(null);
  const [seen, setSeen] = useState<number[]>([]);
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep("landing");
    setType(null);
    setGenres([]);
    setGenre(null);
    setEra(null);
    setResult(null);
    setSeen([]);
    setError(null);
  }, []);

  // Passo 1 → carrega gêneros conforme filme/série
  const handleType = useCallback(async (value: string) => {
    const t = value as MediaType;
    setType(t);
    setGenre(null);
    setGenres([]);
    setError(null);
    setStep("genre");
    try {
      const res = await fetch(`/api/genres?type=${t}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao buscar gêneros.");
      setGenres(data.genres as Genre[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar gêneros.");
    }
  }, []);

  // Sorteio (entrada no resultado e "decide de novo")
  const runDecide = useCallback(
    async (excludeIds: number[]) => {
      if (!type || !genre || !era) return;
      setDeciding(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          type,
          genre: String(genre.id),
          from: String(era.from),
          to: String(era.to),
        });
        if (excludeIds.length) params.set("exclude", excludeIds.join(","));

        const res = await fetch(`/api/decide?${params.toString()}`);
        const data: DecideResult & { error?: string } = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha ao decidir.");

        setResult(data);
        if (data.status === "ok" && data.item) {
          setSeen((prev) => [...prev, data.item!.id]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao decidir.");
      } finally {
        setDeciding(false);
      }
    },
    [type, genre, era]
  );

  const handleEra = useCallback(
    (id: string) => {
      const chosen = ERAS.find((e) => e.id === id);
      if (!chosen) return;
      setEra(chosen);
      setResult(null);
      setSeen([]);
      setStep("result");
      runDecideWith(chosen);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [type, genre]
  );

  // Variante que usa a era recém-escolhida (o estado ainda não propagou no clique).
  const runDecideWith = useCallback(
    async (chosenEra: Era) => {
      if (!type || !genre) return;
      setDeciding(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          type,
          genre: String(genre.id),
          from: String(chosenEra.from),
          to: String(chosenEra.to),
        });
        const res = await fetch(`/api/decide?${params.toString()}`);
        const data: DecideResult & { error?: string } = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha ao decidir.");
        setResult(data);
        if (data.status === "ok" && data.item) {
          setSeen([data.item.id]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao decidir.");
      } finally {
        setDeciding(false);
      }
    },
    [type, genre]
  );

  const genreChoices: Choice[] = genres.map((g) => ({
    id: String(g.id),
    label: g.name,
  }));

  const eraChoices: Choice[] = ERAS.map((e) => ({
    id: e.id,
    label: e.label,
    hint: e.hint,
  }));

  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 py-16">
      {/* Progresso discreto durante as perguntas */}
      {step !== "landing" && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2">
          <Dots total={3} current={STEP_INDEX[step]} />
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          variants={stageVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="flex w-full flex-col items-center"
        >
          {step === "landing" && <Landing onStart={() => setStep("type")} />}

          {step === "type" && (
            <QuestionScreen
              kicker="Primeiro"
              question="Filme ou série?"
              choices={[
                { id: "movie", label: "Filme", hint: "uma noite, um começo e um fim" },
                { id: "tv", label: "Série", hint: "pra quando você quer companhia" },
              ]}
              onSelect={handleType}
              onBack={reset}
            />
          )}

          {step === "genre" && (
            <GenreStep
              choices={genreChoices}
              error={error}
              loading={genres.length === 0 && !error}
              onSelect={(id) => {
                const g = genres.find((x) => String(x.id) === id) || null;
                setGenre(g);
                setStep("era");
              }}
              onBack={() => setStep("type")}
            />
          )}

          {step === "era" && (
            <QuestionScreen
              kicker="Quase lá"
              question="De que época?"
              choices={eraChoices}
              onSelect={handleEra}
              onBack={() => setStep("genre")}
            />
          )}

          {step === "result" && (
            <ResultStage
              deciding={deciding}
              error={error}
              result={result}
              onAgain={() => runDecide(seen)}
              onRestart={reset}
              onChangeGenre={() => setStep("genre")}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}

/* ---------- Telas ---------- */

function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex max-w-2xl flex-col items-center text-center">
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="font-serif text-4xl leading-[1.1] tracking-tight text-cream text-glow sm:text-6xl"
      >
        Quer ver algo mas não sabe
        <br className="hidden sm:block" /> o que assistir?
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="mt-5 font-serif text-2xl italic text-ember sm:text-3xl"
      >
        Deixa que eu decido.
      </motion.p>

      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
        onClick={onStart}
        className="focus-ember group mt-12 inline-flex items-center gap-2 rounded-full bg-ember px-9 py-4 text-base font-medium text-ink shadow-ember transition-colors duration-300 hover:bg-ember-deep"
      >
        Começar
        <span className="transition-transform duration-300 group-hover:translate-x-1">
          →
        </span>
      </motion.button>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.9 }}
        className="mt-16 text-sm text-cream-dim"
      >
        uma escolha por noite
      </motion.p>
    </div>
  );
}

function GenreStep({
  choices,
  loading,
  error,
  onSelect,
  onBack,
}: {
  choices: Choice[];
  loading: boolean;
  error: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  if (error) {
    return <ErrorBlock message={error} onBack={onBack} />;
  }
  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 text-cream-dim">
        <Pulse />
        <p className="text-sm">folheando os gêneros…</p>
      </div>
    );
  }
  return (
    <QuestionScreen
      kicker="Agora"
      question="Que tipo de história?"
      choices={choices}
      onSelect={onSelect}
      onBack={onBack}
      columns={2}
    />
  );
}

function ResultStage({
  deciding,
  error,
  result,
  onAgain,
  onRestart,
  onChangeGenre,
}: {
  deciding: boolean;
  error: string | null;
  result: DecideResult | null;
  onAgain: () => void;
  onRestart: () => void;
  onChangeGenre: () => void;
}) {
  if (error) {
    return <ErrorBlock message={error} onBack={onRestart} />;
  }

  // Primeiro sorteio ainda carregando
  if (!result && deciding) {
    return <Deciding />;
  }

  if (result?.status === "ok" && result.item) {
    return (
      <ResultCard
        item={result.item}
        onAgain={onAgain}
        onRestart={onRestart}
        deciding={deciding}
      />
    );
  }

  if (result?.status === "exhausted" || result?.status === "empty") {
    const msg =
      result.status === "empty"
        ? "Não encontrei nada nessa combinação — a estante tá vazia por aqui."
        : "Acabei minhas cartas dessa categoria.";
    return (
      <div className="flex max-w-md flex-col items-center text-center">
        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-serif text-3xl leading-tight text-cream text-glow"
        >
          {msg}
        </motion.h2>
        <p className="mt-4 text-cream-dim">Quer tentar outro gênero?</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onChangeGenre}
            className="focus-ember rounded-full bg-ember px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-ember-deep"
          >
            Trocar gênero
          </button>
          <button
            onClick={onRestart}
            className="focus-ember rounded-full px-5 py-3 text-sm text-cream-dim transition-colors hover:text-cream"
          >
            Recomeçar
          </button>
        </div>
      </div>
    );
  }

  // fallback (deciding em "decide de novo" sem resultado anterior na tela)
  return <Deciding />;
}

function Deciding() {
  return (
    <div className="flex flex-col items-center gap-5 text-cream-dim">
      <Pulse />
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-serif text-xl text-cream"
      >
        deixa eu pensar…
      </motion.p>
    </div>
  );
}

// Pequeno halo pulsante — a lâmpada "pensando"
function Pulse() {
  return (
    <motion.span
      animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      className="block h-3 w-3 rounded-full bg-ember shadow-ember"
    />
  );
}

function ErrorBlock({
  message,
  onBack,
}: {
  message: string;
  onBack: () => void;
}) {
  return (
    <div className="flex max-w-md flex-col items-center text-center">
      <h2 className="font-serif text-2xl text-cream">Algo apagou a luz.</h2>
      <p className="mt-3 text-sm text-cream-dim">{message}</p>
      <button
        onClick={onBack}
        className="focus-ember mt-8 rounded-full bg-ember px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-ember-deep"
      >
        Tentar de novo
      </button>
    </div>
  );
}
