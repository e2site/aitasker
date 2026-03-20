/*
Назначение: Показывает компактный бейдж текущего статуса задачи.
Не входит: Действия над задачей, сохранение и логика переходов между статусами.
*/
import type { TaskStatus } from "@/shared/contracts/desktop-api";
import { getTaskStatusMeta } from "@/renderer/features/tasks/task-status-meta";
import { cn } from "@/renderer/components/ui/class-names";

export interface TaskStatusBadgeProps {
  status: TaskStatus;
}

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  const meta = getTaskStatusMeta(status);

  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", meta.badgeClass)}>
      {meta.label}
    </span>
  );
}
