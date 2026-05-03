/*
Назначение: Создаёт, читает, обновляет и удаляет текстовые подсказки проекта в локальной SQLite-базе.
Не входит: Индексация векторов, IPC-транспорт и бизнес-валидация содержимого подсказок.
*/
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { PromptHintRecord } from "../../shared/contracts/desktop-api";
import type { AppDatabase } from "./database";
import { promptHintsTable } from "./schema";

export interface CreatePromptHintInput {
  projectId: string;
  text: string;
}

export interface UpdatePromptHintInput {
  text: string;
}

function toPromptHintRecord(row: typeof promptHintsTable.$inferSelect): PromptHintRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    text: row.text,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export class PromptHintRepository {
  constructor(private readonly database: AppDatabase) {}

  async create(input: CreatePromptHintInput): Promise<PromptHintRecord> {
    const id = randomUUID();
    const now = new Date();

    this.database
      .insert(promptHintsTable)
      .values({
        id,
        projectId: input.projectId,
        text: input.text,
        createdAt: now,
        updatedAt: now
      })
      .run();

    const created = await this.getById(id);

    if (!created) {
      throw new Error(`Подсказка ${id} создана, но не найдена в базе.`);
    }

    return created;
  }

  async getById(id: string, projectId?: string): Promise<PromptHintRecord | null> {
    const row = this.database
      .select()
      .from(promptHintsTable)
      .where(
        projectId
          ? and(eq(promptHintsTable.id, id), eq(promptHintsTable.projectId, projectId))
          : eq(promptHintsTable.id, id)
      )
      .get();

    return row ? toPromptHintRecord(row) : null;
  }

  async listByProjectId(projectId: string): Promise<PromptHintRecord[]> {
    const rows = this.database
      .select()
      .from(promptHintsTable)
      .where(eq(promptHintsTable.projectId, projectId))
      .orderBy(desc(promptHintsTable.updatedAt), desc(promptHintsTable.createdAt))
      .all();

    return rows.map(toPromptHintRecord);
  }

  async update(id: string, input: UpdatePromptHintInput): Promise<PromptHintRecord> {
    this.database
      .update(promptHintsTable)
      .set({
        text: input.text,
        updatedAt: new Date()
      })
      .where(eq(promptHintsTable.id, id))
      .run();

    const updated = await this.getById(id);

    if (!updated) {
      throw new Error(`Подсказка ${id} не найдена.`);
    }

    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const result = this.database.delete(promptHintsTable).where(eq(promptHintsTable.id, id)).run();

    return result.changes > 0;
  }
}
