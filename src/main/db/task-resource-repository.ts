/*
Назначение: Создаёт, читает и удаляет связи между задачами и ресурсами (task_resources), возвращая данные привязанного ресурса.
Не входит: Бизнес-валидация, IPC-транспорт и отрисовка UI.
*/
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { LinkedResourceRecord } from "../../shared/contracts/desktop-api";
import type { AppDatabase } from "./database";
import { resourcesTable, taskResourcesTable } from "./schema";

export class TaskResourceRepository {
  constructor(private readonly database: AppDatabase) {}

  async link(input: {
    taskId: string;
    resourceId: string;
    comment: string;
  }): Promise<LinkedResourceRecord> {
    const id = randomUUID();
    const now = new Date();

    this.database
      .insert(taskResourcesTable)
      .values({
        id,
        taskId: input.taskId,
        resourceId: input.resourceId,
        comment: input.comment,
        createdAt: now
      })
      .run();

    const row = this.database
      .select({
        linkId: taskResourcesTable.id,
        resourceId: taskResourcesTable.resourceId,
        comment: taskResourcesTable.comment,
        createdAt: taskResourcesTable.createdAt,
        name: resourcesTable.name,
        contentMd: resourcesTable.contentMd
      })
      .from(taskResourcesTable)
      .innerJoin(resourcesTable, eq(taskResourcesTable.resourceId, resourcesTable.id))
      .where(eq(taskResourcesTable.id, id))
      .get();

    if (!row) {
      throw new Error(`TaskResource ${id} not found after create.`);
    }

    return {
      id: row.linkId,
      resourceId: row.resourceId,
      name: row.name,
      contentMd: row.contentMd,
      comment: row.comment,
      createdAt: row.createdAt.toISOString()
    };
  }

  async listByTaskId(taskId: string): Promise<LinkedResourceRecord[]> {
    const rows = this.database
      .select({
        linkId: taskResourcesTable.id,
        resourceId: taskResourcesTable.resourceId,
        comment: taskResourcesTable.comment,
        createdAt: taskResourcesTable.createdAt,
        name: resourcesTable.name,
        contentMd: resourcesTable.contentMd
      })
      .from(taskResourcesTable)
      .innerJoin(resourcesTable, eq(taskResourcesTable.resourceId, resourcesTable.id))
      .where(eq(taskResourcesTable.taskId, taskId))
      .all();

    return rows.map((row) => ({
      id: row.linkId,
      resourceId: row.resourceId,
      name: row.name,
      contentMd: row.contentMd,
      comment: row.comment,
      createdAt: row.createdAt.toISOString()
    }));
  }

  async unlink(linkId: string): Promise<boolean> {
    const result = this.database
      .delete(taskResourcesTable)
      .where(eq(taskResourcesTable.id, linkId))
      .run();

    return result.changes > 0;
  }
}
