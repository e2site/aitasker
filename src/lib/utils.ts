/*
Назначение: Содержит общие утилиты `shadcn/ui` для безопасного объединения Tailwind-классов.
Не входит: Описание UI-компонентов и правила визуального оформления.
*/
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
