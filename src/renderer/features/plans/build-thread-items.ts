/*
Назначение: Собирает хронологический тред из разных типов элементов плана — одиночных комментариев и пар вопрос-ответ.
Не входит: Рендеринг, хранение данных, мутации.
*/
import type { PlanCommentRecord, PlanQuestionRecord } from "@/shared/contracts/desktop-api";

export type CommentKind = "extension" | "improvement";
export type ThreadKind = CommentKind | "discussion";

/** Одиночный комментарий (расширение или доработка). */
export interface ThreadSingleComment {
  type: "comment";
  comment: PlanCommentRecord;
  kind: CommentKind;
  /** Timestamp для хронологической сортировки. */
  sortKey: number;
}

/** Пара «Вопрос агента + Ответ пользователя». */
export interface ThreadQAPair {
  type: "qa-pair";
  question: PlanQuestionRecord;
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
 * Собирает все элементы треда из комментариев и вопросов в хронологическом порядке.
 * Вопросы (с ответом или без) — ThreadQAPair.
 * Комментарии (extension/improvement) — ThreadSingleComment.
 */
export function buildThreadItems(
  comments: PlanCommentRecord[],
  questions: PlanQuestionRecord[]
): ThreadItem[] {
  const items: ThreadItem[] = [];

  for (const question of questions) {
    items.push({
      type: "qa-pair",
      question,
      kind: "discussion",
      sortKey: toSortKey(question.createdAt),
    });
  }

  for (const comment of comments) {
    items.push({
      type: "comment",
      comment,
      kind: comment.kind as CommentKind,
      sortKey: toSortKey(comment.createdAt),
    });
  }

  // Стабильная хронологическая сортировка: при равных sortKey порядок вставки сохраняется
  items.sort((a, b) => a.sortKey - b.sortKey);

  return items;
}
