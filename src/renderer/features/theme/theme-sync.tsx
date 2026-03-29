/*
Назначение: Синхронизирует выбранную цветовую схему с DOM-классами и browser color-scheme.
Не входит: Хранение выбранной темы и UI для переключения темы.
*/
import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { themeAtom } from "@/renderer/features/theme/theme-state";

export function ThemeSync() {
  const theme = useAtomValue(themeAtom);

  useEffect(() => {
    const isDark = theme === "dark";
    const root = document.documentElement;
    const body = document.body;

    root.classList.toggle("dark", isDark);
    root.classList.toggle("light", !isDark);
    root.style.colorScheme = isDark ? "dark" : "light";

    body.classList.toggle("dark", isDark);
    body.classList.toggle("light", !isDark);

    void window.desktop.setWindowTheme(theme);
  }, [theme]);

  return null;
}
