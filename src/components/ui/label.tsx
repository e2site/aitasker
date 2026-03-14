/*
Назначение: Предоставляет официальный `shadcn/ui` Label для повторного использования в проекте.
Не входит: Бизнес-логика форм и page-specific side effects.
*/
import * as React from "react";
import { cn } from "@/lib/utils";

export interface LabelProps extends React.ComponentProps<"label"> {}

function Label({ className, ...props }: LabelProps) {
  return (
    <label
      data-slot="label"
      className={cn(
        "text-xs font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  );
}

export { Label };
