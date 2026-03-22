/*
Назначение: Содержит чистые helper-функции для панели деталей задачи.
Не входит: React-компоненты, локальное состояние UI и вызовы колбэков.
*/
import type { TaskDetail } from "@/shared/contracts/desktop-api";

export function getOpenQuestionsCount(detail: TaskDetail): number {
  return detail.planQuestions.filter((question) => !question.answeredAt).length;
}

export function isTaskDetailBusy(
  detailState: {
    isDeletingTask: boolean;
    isSavingPlan: boolean;
    isUpdatingStatus: boolean;
    isRestoringRevision: boolean;
  }
): boolean {
  return (
    detailState.isDeletingTask ||
    detailState.isSavingPlan ||
    detailState.isUpdatingStatus ||
    detailState.isRestoringRevision
  );
}

export function formatRuDate(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

export function formatRuDateTime(dateIso: string): string {
  return new Date(dateIso).toLocaleString("ru-RU");
}
