/*
Назначение: Хранит выбранную цветовую схему и автоматически восстанавливает её при запуске приложения.
Не входит: Применение CSS-классов темы к DOM и кнопки переключения темы.
*/
import { atomWithStorage } from "jotai/utils";

export type AppTheme = "light" | "dark";

const THEME_STORAGE_KEY = "app-theme";

function getPreferredTheme(): AppTheme {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export const themeAtom = atomWithStorage<AppTheme>(THEME_STORAGE_KEY, getPreferredTheme(), undefined, {
  getOnInit: true
});
