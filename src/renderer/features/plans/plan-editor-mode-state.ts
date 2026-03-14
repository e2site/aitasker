/*
Purpose: Hold the current view or edit mode of the plan editor area.
Out of scope: Draft content management and save side effects.
*/
import { atom } from "jotai";

export const planEditorModeAtom = atom<"view" | "edit">("view");
