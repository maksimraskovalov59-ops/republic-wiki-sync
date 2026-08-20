export type ThemeId =
  | "dark"
  | "light"
  | "green"
  | "yellow"
  | "purple"
  | "crimson"
  | "mint";

export type ThemeDef = {
  id: ThemeId;
  label: string;
  description: string;
  /** class applied to <html>; empty for the default palette */
  className: string;
  /** requires a signed-in account */
  premium: boolean;
  swatch: [string, string, string];
};

export const THEMES: ThemeDef[] = [
  {
    id: "dark",
    label: "Тёмная",
    description: "Стандартная неоновая тема",
    className: "",
    premium: false,
    swatch: ["#1b2030", "#7fe6f2", "#f070c0"],
  },
  {
    id: "light",
    label: "Светлая",
    description: "Стандартная светлая тема",
    className: "theme-light",
    premium: false,
    swatch: ["#f7f8fb", "#3b6fd4", "#9b57d8"],
  },
  {
    id: "green",
    label: "Изумрудная",
    description: "Тёмно-зелёная, для участников",
    className: "theme-green",
    premium: true,
    swatch: ["#16261e", "#66e39a", "#a7e355"],
  },
  {
    id: "yellow",
    label: "Янтарная",
    description: "Тёплая жёлтая, для участников",
    className: "theme-yellow",
    premium: true,
    swatch: ["#26200f", "#f2cc55", "#e08a3c"],
  },
  {
    id: "purple",
    label: "Аметист",
    description: "Фиолетовая, для участников",
    className: "theme-purple",
    premium: true,
    swatch: ["#1f1630", "#b97ef5", "#ec6fc4"],
  },
  {
    id: "crimson",
    label: "Багровая",
    description: "Красная, для участников",
    className: "theme-crimson",
    premium: true,
    swatch: ["#2a1518", "#f0705e", "#f0a05e"],
  },
  {
    id: "mint",
    label: "Мятная",
    description: "Светлая мятная, для участников",
    className: "theme-mint",
    premium: true,
    swatch: ["#f2fbfa", "#2f9fa8", "#3fb08a"],
  },
];

export const THEME_CLASSES = THEMES.map((t) => t.className).filter(Boolean);
export const FREE_THEMES = THEMES.filter((t) => !t.premium);
export const STORAGE_KEY = "rmc-wiki-theme";

export function getTheme(id: string | null | undefined): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}
