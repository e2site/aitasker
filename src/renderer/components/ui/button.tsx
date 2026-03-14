/*
Назначение: Сохраняет совместимость старых renderer-импортов и перенаправляет их на установленный `shadcn/ui` Button.
Не входит: Собственная реализация кнопки и бизнес-логика действий.
*/
export { Button, buttonVariants } from "@/components/ui/button";
export type { ButtonProps } from "@/components/ui/button";
