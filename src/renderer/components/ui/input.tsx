/*
Назначение: Сохраняет совместимость renderer-импортов и перенаправляет их на установленный `shadcn/ui` Input.
Не входит: Собственная реализация поля ввода и бизнес-логика действий.
*/
import type { ComponentProps } from "react";

export { Input } from "@/components/ui/input";
export type InputProps = ComponentProps<typeof import("@/components/ui/input").Input>;
