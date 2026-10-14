"use client";

// Indicador de progresso discreto — três pontinhos, sem barra agressiva.
export function Dots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center justify-center gap-2" aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all duration-500 ${
            i === current
              ? "w-6 bg-ember"
              : i < current
                ? "w-1.5 bg-ember/50"
                : "w-1.5 bg-cream/15"
          }`}
        />
      ))}
    </div>
  );
}
