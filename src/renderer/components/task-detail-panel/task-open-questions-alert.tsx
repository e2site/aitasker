/*
Назначение: Показывает предупреждение о незакрытых вопросах плана и ограничении смены статуса.
Не входит: Подсчет количества открытых вопросов и логика смены статуса.
*/
export interface TaskOpenQuestionsAlertProps {
  openQuestionsCount: number;
}

export function TaskOpenQuestionsAlert({ openQuestionsCount }: TaskOpenQuestionsAlertProps) {
  return (
    <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:text-rose-400 px-4 py-3 text-sm text-rose-700">
      У задачи есть открытые вопросы: {openQuestionsCount}. Через интерфейс можно выставить только статус{" "}
      <strong>Требует уточнений</strong>{" "}
      или оставить текущий статус, пока все вопросы не будут закрыты в обсуждении.
    </div>
  );
}
