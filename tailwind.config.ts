import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta "Abajur às 22h"
        ink: {
          DEFAULT: "#1A1412", // fundo principal — marrom-quase-preto, quente
          soft: "#241B17",    // cards / superfícies elevadas
          deep: "#120D0B",    // vinheta das bordas
        },
        ember: {
          DEFAULT: "#E8A765", // acento — luz de abajur
          deep: "#C8823F",    // hover / pressed
        },
        cream: {
          DEFAULT: "#F2E8DC", // texto principal
          dim: "#A89A8C",     // texto secundário
        },
      },
      fontFamily: {
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        ember: "0 0 0 1px rgba(232,167,101,0.25), 0 12px 40px -12px rgba(232,167,101,0.45)",
      },
      keyframes: {
        flicker: {
          "0%, 100%": { opacity: "0.85" },
          "45%": { opacity: "1" },
          "55%": { opacity: "0.92" },
        },
      },
      animation: {
        flicker: "flicker 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
