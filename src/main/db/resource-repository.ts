/*
Назначение: Создаёт, читает, обновляет и удаляет ресурсы (глобальные Markdown-документы), независимые от проектов.
Не входит: Привязка ресурсов к задачам, IPC-транспорт и бизнес-валидация.
*/
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { ResourceRecord } from "../../shared/contracts/desktop-api";
import type { AppDatabase } from "./database";
import { resourcesTable } from "./schema";

function mapRow(row: typeof resourcesTable.$inferSelect): ResourceRecord {
  return {
    id: row.id,
    name: row.name,
    contentMd: row.contentMd,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export class ResourceRepository {
  constructor(private readonly database: AppDatabase) {}

  async create(input: { name: string; contentMd?: string }): Promise<ResourceRecord> {
    const id = randomUUID();
    const now = new Date();

    this.database
      .insert(resourcesTable)
      .values({
        id,
        name: input.name,
        contentMd: input.contentMd ?? "",
        createdAt: now,
        updatedAt: now
      })
      .run();

    const row = this.database
      .select()
      .from(resourcesTable)
      .where(eq(resourcesTable.id, id))
      .get();

    if (!row) {
      throw new Error(`Resource ${id} not found after create.`);
    }

    return mapRow(row);
  }

  async getById(id: string): Promise<ResourceRecord | undefined> {
    const row = this.database
      .select()
      .from(resourcesTable)
      .where(eq(resourcesTable.id, id))
      .get();

    return row ? mapRow(row) : undefined;
  }

  async list(): Promise<ResourceRecord[]> {
    const rows = this.database
      .select()
      .from(resourcesTable)
      .orderBy(desc(resourcesTable.updatedAt))
      .all();

    return rows.map(mapRow);
  }

  async update(id: string, input: { name?: string; contentMd?: string }): Promise<ResourceRecord> {
    const now = new Date();

    this.database
      .update(resourcesTable)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.contentMd !== undefined ? { contentMd: input.contentMd } : {}),
        updatedAt: now
      })
      .where(eq(resourcesTable.id, id))
      .run();

    const row = this.database
      .select()
      .from(resourcesTable)
      .where(eq(resourcesTable.id, id))
      .get();

    if (!row) {
      throw new Error(`Resource ${id} not found.`);
    }

    return mapRow(row);
  }

  async delete(id: string): Promise<void> {
    this.database.delete(resourcesTable).where(eq(resourcesTable.id, id)).run();
  }
}
