/*
Назначение: Отрисовывает выпадающий список смены статуса задачи с учетом ограничений по открытым вопросам.
Не входит: Сохранение статуса в API и отображение остальных элементов карточки задачи.
*/
import { ChevronDown } from "lucide-react";
import type { TaskStatus } from "@/shared/contracts/desktop-api";
import { getTaskStatusMeta, TASK_STATUS_LIST } from "@/renderer/features/tasks/task-status-meta";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/renderer/components/ui/dropdown-menu";

export interface TaskStatusDropdownProps {
  disabled: boolean;
  hasOpenQuestions: boolean;
  onUpdate(status: TaskStatus): void;
  status: TaskStatus;
}

export function TaskStatusDropdown({ disabled, hasOpenQuestions, onUpdate, status }: TaskStatusDropdownProps) {
  const current = getTaskStatusMeta(status);

  const isStatusLockedByQuestions = (nextStatus: TaskStatus) =>
    hasOpenQuestions && nextStatus !== status && nextStatus !== "requires_clarification";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={`inline-flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50 ${current.textClass}`}
        >
          <span className="flex items-center gap-2">
            <span className={`size-2 rounded-full ${current.dotClass}`} />
            {current.label}
          </span>
          <ChevronDown className="size-3.5 text-slate-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width] bg-white p-1.5 shadow-lg">
        {TASK_STATUS_LIST.map((statusItem) => (
          <DropdownMenuItem
            key={statusItem.value}
            disabled={isStatusLockedByQuestions(statusItem.value)}
            onClick={() => onUpdate(statusItem.value)}
            className={`mb-1 rounded-lg px-3 py-2 text-sm font-medium last:mb-0 ${statusItem.badgeClass} hover:bg-opacity-80`}
          >
            <span className={`size-2 rounded-full ${statusItem.dotClass}`} />
            {statusItem.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
