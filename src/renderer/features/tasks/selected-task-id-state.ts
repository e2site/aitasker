/*
Purpose: Hold the currently selected task id for the renderer workspace.
Out of scope: Data fetching, form validation, and persistence.
*/
import { atom } from "jotai";

export const selectedTaskIdAtom = atom<string | null>(null);
