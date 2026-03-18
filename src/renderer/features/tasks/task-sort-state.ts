/*
Назначение: Атом сортировки таблицы задач с сохранением в localStorage.
Не входит: UI-компоненты, логика фильтрации и загрузка данных.
*/
import { atomWithStorage } from "jotai/utils";
import type { TaskStatus } from "@/shared/contracts/desktop-api";

export type SortField = "status" | "title" | "projectName" | "updatedAt";
export type SortDirection = "asc" | "desc";

export interface TaskSortState {
  field: SortField;
  direction: SortDirection;
}

export const STATUS_ORDER: Record<TaskStatus, number> = {
  new: 0,
  planning: 1,
  requires_clarification: 2,
  implementation: 3,
  testing: 4,
  completed: 5
};

export const taskSortAtom = atomWithStorage<TaskSortState>("task-sort", {
  field: "updatedAt",
  direction: "desc"
});
