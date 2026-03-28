import { atomWithStorage } from "jotai/utils";

export type AppTheme = "light" | "dark";

export const themeAtom = atomWithStorage<AppTheme>("app-theme", "light");
