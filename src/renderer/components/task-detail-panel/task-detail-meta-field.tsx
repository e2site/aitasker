/*
Назначение: Отрисовывает мета-поле в правой колонке панели задачи.
Не входит: Бизнес-логика задачи, загрузка данных и интерактивные контролы статуса.
*/
import type { ReactNode } from "react";

export interface TaskDetailMetaFieldProps {
  label: string;
  value: ReactNode;
}

export function TaskDetailMetaField({ label, value }: TaskDetailMetaFieldProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground/70">{value || <em className="not-italic text-muted-foreground/50">нет</em>}</span>
    </div>
  );
}
