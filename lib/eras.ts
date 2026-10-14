// Faixas de lançamento como categorias narrativas, não números secos.
export interface Era {
  id: string;
  label: string;
  hint: string; // a faixa de anos, dita de leve
  from: number;
  to: number;
}

const CURRENT_YEAR = new Date().getFullYear();

export const ERAS: Era[] = [
  {
    id: "classicos",
    label: "Clássicos",
    hint: "1920 – 1959",
    from: 1920,
    to: 1959,
  },
  {
    id: "ouro",
    label: "Era de Ouro",
    hint: "1960 – 1989",
    from: 1960,
    to: 1989,
  },
  {
    id: "modernos",
    label: "Modernos",
    hint: "1990 – 2009",
    from: 1990,
    to: 2009,
  },
  {
    id: "recentes",
    label: "Recentes",
    hint: "2010 – 2024",
    from: 2010,
    to: 2024,
  },
  {
    id: "atual",
    label: "Atual",
    hint: "2025 em diante",
    from: 2025,
    to: CURRENT_YEAR,
  },
];
