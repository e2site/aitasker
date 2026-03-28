/*
Назначение: Сохраняет совместимость старых renderer-импортов и перенаправляет их на установленный `shadcn/ui` Button.
Не входит: Собственная реализация кнопки и бизнес-логика действий.
*/
import type { ComponentProps } from "react";

export { Button, buttonVariants } from "@/components/ui/button";
export type ButtonProps = ComponentProps<typeof import("@/components/ui/button").Button>;
