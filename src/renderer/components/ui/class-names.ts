/*
Purpose: Merge conditional class names in a way that is compatible with Tailwind utility conflicts.
Out of scope: Component styling rules and variant definitions.
*/
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
