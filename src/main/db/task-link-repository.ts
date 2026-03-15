/*
Назначение: Создаёт, читает и удаляет связи между задачами (task_links), возвращая данные связанной задачи.
Не входит: Бизнес-валидация, IPC-транспорт и отрисовка UI.
*/
import { randomUUID } from "node:crypto";
import { eq, or } from "drizzle-orm";
import type { LinkedTaskRecord, TaskStatus } from "../../shared/contracts/desktop-api";
import type { AppDatabase } from "./database";
import { projectsTable, taskLinksTable, tasksTable } from "./schema";

export class TaskLinkRepository {
  constructor(private readonly database: AppDatabase) {}

  async create(input: {
    sourceTaskId: string;
    targetTaskId: string;
    comment: string;
  }): Promise<{ id: string; sourceTaskId: string; targetTaskId: string; comment: string; createdAt: string }> {
    const id = randomUUID();
    const now = new Date();

    this.database
      .insert(taskLinksTable)
      .values({
        id,
        sourceTaskId: input.sourceTaskId,
        targetTaskId: input.targetTaskId,
        comment: input.comment,
        createdAt: now
      })
      .run();

    return {
      id,
      sourceTaskId: input.sourceTaskId,
      targetTaskId: input.targetTaskId,
      comment: input.comment,
      createdAt: now.toISOString()
    };
  }

  async listByTaskId(taskId: string): Promise<LinkedTaskRecord[]> {
    const rows = this.database
      .select({
        linkId: taskLinksTable.id,
        sourceTaskId: taskLinksTable.sourceTaskId,
        targetTaskId: taskLinksTable.targetTaskId,
        comment: taskLinksTable.comment,
        createdAt: taskLinksTable.createdAt,
        linkedTaskId: tasksTable.id,
        linkedTaskTitle: tasksTable.title,
        linkedTaskStatus: tasksTable.status,
        linkedProjectName: projectsTable.name
      })
      .from(taskLinksTable)
      .innerJoin(
        tasksTable,
        or(
          eq(taskLinksTable.targetTaskId, tasksTable.id),
          eq(taskLinksTable.sourceTaskId, tasksTable.id)
        )
      )
      .innerJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
      .where(or(eq(taskLinksTable.sourceTaskId, taskId), eq(taskLinksTable.targetTaskId, taskId)))
      .all();

    // Фильтруем строки: для каждой связи берём только запись связанной задачи (не текущей)
    const result: LinkedTaskRecord[] = [];

    for (const row of rows) {
      // Пропускаем строку, если это запись самой текущей задачи (а не связанной)
      if (row.linkedTaskId === taskId) {
        continue;
      }

      const direction: "outgoing" | "incoming" =
        row.sourceTaskId === taskId ? "outgoing" : "incoming";

      result.push({
        id: row.linkId,
        taskId: row.linkedTaskId,
        title: row.linkedTaskTitle,
        status: row.linkedTaskStatus as TaskStatus,
        projectName: row.linkedProjectName,
        comment: row.comment,
        direction,
        createdAt: row.createdAt.toISOString()
      });
    }

    return result;
  }

  async delete(linkId: string): Promise<boolean> {
    const result = this.database
      .delete(taskLinksTable)
      .where(eq(taskLinksTable.id, linkId))
      .run();

    return result.changes > 0;
  }
}
