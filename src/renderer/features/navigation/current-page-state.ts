import { atom } from "jotai";

export type AppPage = "tasks" | "resources";

export const currentPageAtom = atom<AppPage>("tasks");
