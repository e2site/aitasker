/*
Назначение: Атом сортировки таблицы задач с сохранением в localStorage.
Не входит: UI-компоненты, логика фильтрации и загрузка данных.
*/
import { atomWithStorage } from "jotai/utils";
import { TASK_STATUS_SORT_ORDER } from "@/renderer/features/tasks/task-status-meta";

export type SortField = "status" | "title" | "projectName" | "createdAt" | "updatedAt";
export type SortDirection = "asc" | "desc";

export interface TaskSortState {
  field: SortField;
  direction: SortDirection;
}

export const STATUS_ORDER = TASK_STATUS_SORT_ORDER;

export const taskSortAtom = atomWithStorage<TaskSortState>("task-sort", {
  field: "updatedAt",
  direction: "desc"
});
