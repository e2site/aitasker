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
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <span className="text-sm text-slate-700">{value || <em className="not-italic text-slate-300">нет</em>}</span>
    </div>
  );
}
