import { atom } from "jotai";

export type DrawerPage = "create-task" | "create-project" | "prompt-overrides" | "project-settings" | null;

export const drawerPageAtom = atom<DrawerPage>(null);
