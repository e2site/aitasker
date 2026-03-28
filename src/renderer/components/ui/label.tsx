/*
Назначение: Сохраняет совместимость renderer-импортов и перенаправляет их на установленный `shadcn/ui` Label.
Не входит: Собственная реализация лейбла и бизнес-логика форм.
*/
import type { ComponentProps } from "react";

export { Label } from "@/components/ui/label";
export type LabelProps = ComponentProps<typeof import("@/components/ui/label").Label>;
