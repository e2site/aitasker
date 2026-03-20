/*
Назначение: Хранит единые UI-метаданные статусов задач для списков, бейджей, фильтров, шпаргалок и сортировки.
Не входит: Доменная валидация статусов, изменение статуса задачи и отрисовка конкретных экранов.
*/
import { taskStatusSchema, type TaskStatus } from "@/shared/contracts/desktop-api";

export interface TaskStatusMeta {
  badgeClass: string;
  dotClass: string;
  dotColor: string;
  filterLabel: string;
  groupLabel: string;
  label: string;
  promptGuideClass: string;
  textClass: string;
}

const TASK_STATUS_META_BY_VALUE: Record<TaskStatus, TaskStatusMeta> = {
  new: {
    badgeClass: "bg-slate-200 text-slate-800",
    dotClass: "bg-slate-400",
    dotColor: "#94a3b8",
    filterLabel: "Новые",
    groupLabel: "Новые",
    label: "Новая",
    promptGuideClass: "bg-slate-200 text-slate-700",
    textClass: "text-slate-500"
  },
  planning: {
    badgeClass: "bg-sky-100 text-sky-800",
    dotClass: "bg-sky-500",
    dotColor: "#38bdf8",
    filterLabel: "Планирование",
    groupLabel: "Планирование",
    label: "Планирование",
    promptGuideClass: "bg-sky-100 text-sky-700",
    textClass: "text-sky-600"
  },
  requires_clarification: {
    badgeClass: "bg-rose-100 text-rose-800",
    dotClass: "bg-rose-500",
    dotColor: "#f87171",
    filterLabel: "Уточнение",
    groupLabel: "Требуют уточнений",
    label: "Требует уточнений",
    promptGuideClass: "bg-rose-100 text-rose-700",
    textClass: "text-rose-600"
  },
  implementation: {
    badgeClass: "bg-amber-100 text-amber-800",
    dotClass: "bg-amber-500",
    dotColor: "#fbbf24",
    filterLabel: "Реализация",
    groupLabel: "Реализация",
    label: "Реализация",
    promptGuideClass: "bg-amber-100 text-amber-700",
    textClass: "text-amber-600"
  },
  testing: {
    badgeClass: "bg-purple-100 text-purple-800",
    dotClass: "bg-purple-500",
    dotColor: "#a855f7",
    filterLabel: "Тестирование",
    groupLabel: "Тестирование",
    label: "Тестирование",
    promptGuideClass: "bg-purple-100 text-purple-700",
    textClass: "text-purple-600"
  },
  completed: {
    badgeClass: "bg-emerald-100 text-emerald-800",
    dotClass: "bg-emerald-500",
    dotColor: "#34d399",
    filterLabel: "Выполнено",
    groupLabel: "Выполнено",
    label: "Выполнено",
    promptGuideClass: "bg-emerald-100 text-emerald-700",
    textClass: "text-emerald-600"
  }
};

export const TASK_STATUS_ORDER = [...taskStatusSchema.options] as TaskStatus[];

export const TASK_STATUS_SORT_ORDER: Record<TaskStatus, number> = TASK_STATUS_ORDER.reduce(
  (accumulator, status, index) => {
    accumulator[status] = index;
    return accumulator;
  },
  {} as Record<TaskStatus, number>
);

export const TASK_STATUS_LIST = TASK_STATUS_ORDER.map((value) => ({
  value,
  ...TASK_STATUS_META_BY_VALUE[value]
}));

export function getTaskStatusMeta(status: TaskStatus): TaskStatusMeta {
  return TASK_STATUS_META_BY_VALUE[status];
}
