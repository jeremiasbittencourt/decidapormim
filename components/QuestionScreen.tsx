"use client";

import { motion } from "framer-motion";

export interface Choice {
  id: string;
  label: string;
  hint?: string;
}

// Tela genérica de pergunta: uma pergunta, foco total, opções em stagger suave.
export function QuestionScreen({
  kicker,
  question,
  choices,
  onSelect,
  onBack,
  columns = 2,
}: {
  kicker?: string;
  question: string;
  choices: Choice[];
  onSelect: (id: string) => void;
  onBack?: () => void;
  columns?: 1 | 2;
}) {
  return (
    <div className="flex w-full max-w-2xl flex-col items-center text-center">
      {kicker && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="mb-4 text-sm uppercase tracking-[0.2em] text-cream-dim"
        >
          {kicker}
        </motion.p>
      )}

      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mb-10 font-serif text-3xl leading-tight text-cream text-glow sm:text-4xl"
      >
        {question}
      </motion.h2>

      <div
        className={`grid w-full gap-3 ${
          columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-1"
        }`}
      >
        {choices.map((choice, i) => (
          <motion.button
            key={choice.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: 0.15 + i * 0.06,
              ease: [0.22, 1, 0.36, 1],
            }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(choice.id)}
            className="focus-ember group flex flex-col items-start gap-1 rounded-2xl border border-cream/10 bg-ink-soft/70 px-6 py-5 text-left transition-colors duration-300 hover:border-ember/40 hover:bg-ink-soft"
          >
            <span className="font-serif text-xl text-cream transition-colors group-hover:text-ember">
              {choice.label}
            </span>
            {choice.hint && (
              <span className="text-sm text-cream-dim">{choice.hint}</span>
            )}
          </motion.button>
        ))}
      </div>

      {onBack && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          onClick={onBack}
          className="focus-ember mt-10 rounded-full px-4 py-2 text-sm text-cream-dim transition-colors hover:text-cream"
        >
          ← voltar
        </motion.button>
      )}
    </div>
  );
}
