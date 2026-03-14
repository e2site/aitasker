/*
Назначение: Показывает компактный бейдж текущего статуса задачи.
Не входит: Действия над задачей, сохранение и логика переходов между статусами.
*/
import type { TaskStatus } from "@/shared/contracts/desktop-api";
import { cn } from "@/renderer/components/ui/class-names";

const statusClasses: Record<TaskStatus, string> = {
  new: "bg-slate-200 text-slate-800",
  planning: "bg-sky-100 text-sky-800",
  implementation: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800"
};
const statusLabels: Record<TaskStatus, string> = {
  new: "Новая",
  planning: "Планирование",
  implementation: "Реализация",
  completed: "Выполнено"
};

export interface TaskStatusBadgeProps {
  status: TaskStatus;
}

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", statusClasses[status])}>
      {statusLabels[status]}
    </span>
  );
}
