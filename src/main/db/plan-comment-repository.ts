/*
Назначение: Хранит и читает комментарии плана (discussion, extension, improvement) и вопросы как самостоятельные записи БД.
Не входит: Парсинг Markdown-блоков, бизнес-логика сервисов, IPC-транспорт.
*/
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type {
  PlanCommentKind,
  PlanCommentRecord,
  PlanQuestionRecord
} from "../../shared/contracts/desktop-api";
import type { AppDatabase } from "./database";
import { planCommentsTable, planQuestionsTable } from "./schema";

function toCommentRecord(row: typeof planCommentsTable.$inferSelect): PlanCommentRecord {
  return {
    id: row.id,
    planId: row.planId,
    taskId: row.taskId,
    kind: row.kind as PlanCommentKind,
    author: row.author as PlanCommentRecord["author"],
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function toQuestionRecord(row: typeof planQuestionsTable.$inferSelect): PlanQuestionRecord {
  return {
    id: row.id,
    planId: row.planId,
    taskId: row.taskId,
    content: row.content,
    answer: row.answer ?? null,
    answeredAt: row.answeredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export class PlanCommentRepository {
  constructor(private readonly database: AppDatabase) {}

  // ─── Comments ───────────────────────────────────────────────────────────────

  async addComment(input: {
    planId: string;
    taskId: string;
    kind: PlanCommentKind;
    author: PlanCommentRecord["author"];
    content: string;
  }): Promise<PlanCommentRecord> {
    const id = randomUUID();
    const now = new Date();

    this.database
      .insert(planCommentsTable)
      .values({ id, ...input, createdAt: now, updatedAt: now })
      .run();

    const row = this.database
      .select()
      .from(planCommentsTable)
      .where(eq(planCommentsTable.id, id))
      .get();

    if (!row) throw new Error(`PlanComment ${id} not found after insert.`);

    return toCommentRecord(row);
  }

  async listCommentsByTaskId(taskId: string): Promise<PlanCommentRecord[]> {
    const rows = this.database
      .select()
      .from(planCommentsTable)
      .where(eq(planCommentsTable.taskId, taskId))
      .all();

    return rows.map(toCommentRecord);
  }

  async deleteCommentsByPlanId(planId: string): Promise<void> {
    this.database
      .delete(planCommentsTable)
      .where(eq(planCommentsTable.planId, planId))
      .run();
  }

  // ─── Questions ───────────────────────────────────────────────────────────────

  async addQuestion(input: {
    planId: string;
    taskId: string;
    content: string;
  }): Promise<PlanQuestionRecord> {
    const id = randomUUID();
    const now = new Date();

    this.database
      .insert(planQuestionsTable)
      .values({ id, ...input, answer: null, answeredAt: null, createdAt: now, updatedAt: now })
      .run();

    const row = this.database
      .select()
      .from(planQuestionsTable)
      .where(eq(planQuestionsTable.id, id))
      .get();

    if (!row) throw new Error(`PlanQuestion ${id} not found after insert.`);

    return toQuestionRecord(row);
  }

  async answerQuestion(questionId: string, answer: string): Promise<PlanQuestionRecord> {
    const now = new Date();

    this.database
      .update(planQuestionsTable)
      .set({ answer, answeredAt: now, updatedAt: now })
      .where(eq(planQuestionsTable.id, questionId))
      .run();

    const row = this.database
      .select()
      .from(planQuestionsTable)
      .where(eq(planQuestionsTable.id, questionId))
      .get();

    if (!row) throw new Error(`PlanQuestion ${questionId} not found after update.`);

    return toQuestionRecord(row);
  }

  async listQuestionsByTaskId(taskId: string): Promise<PlanQuestionRecord[]> {
    const rows = this.database
      .select()
      .from(planQuestionsTable)
      .where(eq(planQuestionsTable.taskId, taskId))
      .all();

    return rows.map(toQuestionRecord);
  }

  async getQuestionById(questionId: string): Promise<PlanQuestionRecord | null> {
    const row = this.database
      .select()
      .from(planQuestionsTable)
      .where(eq(planQuestionsTable.id, questionId))
      .get();

    return row ? toQuestionRecord(row) : null;
  }

  async deleteQuestionsByPlanId(planId: string): Promise<void> {
    this.database
      .delete(planQuestionsTable)
      .where(eq(planQuestionsTable.planId, planId))
      .run();
  }

  async deleteOpenQuestionsByPlanId(planId: string): Promise<void> {
    this.database
      .delete(planQuestionsTable)
      .where(
        and(eq(planQuestionsTable.planId, planId), eq(planQuestionsTable.answeredAt, null as any))
      )
      .run();
  }
}
