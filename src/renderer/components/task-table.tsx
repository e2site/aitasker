/*
Назначение: Рендерит таблицу задач в стиле Jira — строка = задача, с колонками статус/название/проект/дата/ID.
Поддерживает сортировку по кликабельным заголовкам с сохранением настроек в localStorage.
Не входит: Фильтрация, загрузка данных и панель деталей задачи.
*/
import { useAtom } from "jotai";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import type { TaskRecord } from "@/shared/contracts/desktop-api";
import { TaskStatusBadge } from "@/renderer/components/task-status-badge";
import { cn } from "@/renderer/components/ui/class-names";
import {
  taskSortAtom,
  STATUS_ORDER,
  type SortField,
  type TaskSortState
} from "@/renderer/features/tasks/task-sort-state";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

function sortTasks(tasks: TaskRecord[], sort: TaskSortState): TaskRecord[] {
  return [...tasks].sort((a, b) => {
    let cmp = 0;
    if (sort.field === "status") {
      cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    } else if (sort.field === "createdAt" || sort.field === "updatedAt") {
      cmp = new Date(a[sort.field]).getTime() - new Date(b[sort.field]).getTime();
    } else {
      cmp = (a[sort.field] ?? "").localeCompare(b[sort.field] ?? "", "ru");
    }
    return sort.direction === "asc" ? cmp : -cmp;
  });
}

interface SortableHeaderProps {
  field: SortField;
  label: string;
  sort: TaskSortState;
  onSort(field: SortField): void;
  className?: string;
}

function SortableHeader({ field, label, sort, onSort, className }: SortableHeaderProps) {
  const isActive = sort.field === field;
  return (
    <th
      onClick={() => onSort(field)}
      className={cn(
        "cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 hover:text-slate-600 transition-colors",
        className
      )}
    >
      <span className="flex items-center gap-1">
        {label}
        {isActive ? (
          sort.direction === "asc"
            ? <ChevronUp className="size-3 text-slate-500" />
            : <ChevronDown className="size-3 text-slate-500" />
        ) : (
          <ChevronsUpDown className="size-3 opacity-40" />
        )}
      </span>
    </th>
  );
}

export interface TaskTableProps {
  onSelect(taskId: string): void;
  selectedTaskId: string | null;
  showProject: boolean;
  tasks: TaskRecord[];
}

export function TaskTable({ tasks, selectedTaskId, showProject, onSelect }: TaskTableProps) {
  const [sort, setSort] = useAtom(taskSortAtom);

  const handleSort = (field: SortField) => {
    setSort((prev) =>
      prev.field === field
        ? { field, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { field, direction: "desc" }
    );
  };

  const sortedTasks = sortTasks(tasks, sort);

  if (tasks.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-16 text-sm text-slate-500">
        Нет задач, соответствующих фильтрам.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80">
            <SortableHeader field="status" label="Статус" sort={sort} onSort={handleSort} />
            <SortableHeader field="title" label="Задача" sort={sort} onSort={handleSort} />
            {showProject && (
              <SortableHeader field="projectName" label="Проект" sort={sort} onSort={handleSort} />
            )}
            <SortableHeader field="createdAt" label="Создано" sort={sort} onSort={handleSort} />
            <SortableHeader field="updatedAt" label="Обновлено" sort={sort} onSort={handleSort} />
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              ID
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedTasks.map((task, index) => {
            const isActive = task.id === selectedTaskId;
            return (
              <tr
                key={task.id}
                onClick={() => onSelect(task.id)}
                className={cn(
                  "cursor-pointer border-b border-slate-100 transition last:border-0",
                  isActive
                    ? "bg-slate-100 ring-1 ring-inset ring-slate-300"
                    : index % 2 === 0
                      ? "hover:bg-slate-50"
                      : "bg-slate-50/40 hover:bg-slate-50"
                )}
              >
                {/* Status */}
                <td className="px-4 py-3">
                  <TaskStatusBadge status={task.status} />
                </td>

                {/* Title + description */}
                <td className="max-w-xs px-4 py-3 lg:max-w-sm">
                  <p className={cn("truncate font-medium", isActive ? "text-slate-900" : "text-slate-800")}>
                    {task.title}
                  </p>
                  {task.description ? (
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{task.description}</p>
                  ) : null}
                </td>

                {/* Project */}
                {showProject && (
                  <td className="px-4 py-3">
                    <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {task.projectName}
                    </span>
                  </td>
                )}

                {/* Created at */}
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
                  {formatDate(task.createdAt)}
                </td>

                {/* Updated at */}
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
                  {formatDate(task.updatedAt)}
                </td>

                {/* Short ID */}
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-slate-400">
                    {task.id.slice(0, 8).toUpperCase()}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
