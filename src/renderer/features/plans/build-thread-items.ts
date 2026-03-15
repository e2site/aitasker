/*
Назначение: Собирает хронологический тред из разных типов элементов плана — одиночных комментариев и пар вопрос-ответ.
Не входит: Рендеринг, хранение данных, мутации.
*/
import type { ManagedPlanComment, ManagedPlanContent } from "@/shared/plans/managed-plan-content";

export type CommentKind = "extension" | "improvement";
export type ThreadKind = CommentKind | "discussion";

/** Одиночный комментарий (расширение, доработка или произвольное сообщение в обсуждении). */
export interface ThreadSingleComment {
  type: "comment";
  comment: ManagedPlanComment;
  kind: ThreadKind;
  /** Timestamp для хронологической сортировки. */
  sortKey: number;
}

/** Пара «Вопрос агента + Ответ пользователя» из раздела discussion. */
export interface ThreadQAPair {
  type: "qa-pair";
  question: ManagedPlanComment;
  answer: ManagedPlanComment;
  kind: "discussion";
  sortKey: number;
}

export type ThreadItem = ThreadSingleComment | ThreadQAPair;

function toSortKey(createdAt: string | null): number {
  if (!createdAt) return Infinity;
  const ms = new Date(createdAt).getTime();
  return Number.isNaN(ms) ? Infinity : ms;
}

/**
 * Определяет, является ли комментарий записью «Вопрос» (author=agent, content начинается с «**Вопрос:**»).
 */
function isQuestionComment(comment: ManagedPlanComment): boolean {
  return comment.author === "agent" && comment.content.startsWith("**Вопрос:**");
}

/**
 * Определяет, является ли комментарий записью «Ответ» (author=human, content начинается с «**Ответ:**»).
 */
function isAnswerComment(comment: ManagedPlanComment): boolean {
  return comment.author === "human" && comment.content.startsWith("**Ответ:**");
}

/**
 * Собирает все элементы треда из разобранного плана в хронологическом порядке.
 * Записи из discussion с паттерном «Вопрос + следующий Ответ» группируются в ThreadQAPair.
 * Все остальные записи (extensions, improvements, одиночные discussion) остаются ThreadSingleComment.
 *
 * Функция расширяема: добавление новых видов ThreadItem требует только изменения этой функции.
 */
export function buildThreadItems(parsed: ManagedPlanContent): ThreadItem[] {
  const items: ThreadItem[] = [];

  // Группируем discussion: ищем последовательные пары Вопрос→Ответ
  const discussion = parsed.discussion;
  let i = 0;
  while (i < discussion.length) {
    const current = discussion[i];
    const next = discussion[i + 1];

    if (current && isQuestionComment(current) && next && isAnswerComment(next)) {
      items.push({
        type: "qa-pair",
        question: current,
        answer: next,
        kind: "discussion",
        sortKey: toSortKey(current.createdAt),
      });
      i += 2;
    } else if (current) {
      items.push({
        type: "comment",
        comment: current,
        kind: "discussion",
        sortKey: toSortKey(current.createdAt),
      });
      i += 1;
    } else {
      i += 1;
    }
  }

  // Добавляем расширения и доработки как одиночные комментарии
  for (const comment of parsed.extensions) {
    items.push({
      type: "comment",
      comment,
      kind: "extension",
      sortKey: toSortKey(comment.createdAt),
    });
  }

  for (const comment of parsed.improvements) {
    items.push({
      type: "comment",
      comment,
      kind: "improvement",
      sortKey: toSortKey(comment.createdAt),
    });
  }

  // Стабильная хронологическая сортировка: при равных sortKey порядок вставки сохраняется
  items.sort((a, b) => a.sortKey - b.sortKey);

  return items;
}
