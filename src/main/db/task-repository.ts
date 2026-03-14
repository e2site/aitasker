/*
Назначение: Сохраняет, читает и удаляет задачи в локальной SQLite-базе вместе с их привязкой к проектам.
Не входит: Генерация планов, IPC и управление состоянием renderer.
*/
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { TaskRecord, TaskStatus } from "../../shared/contracts/desktop-api";
import type { AppDatabase } from "./database";
import { projectsTable, tasksTable } from "./schema";

interface TaskRow {
  createdAt: Date;
  description: string;
  id: string;
  projectId: string;
  projectName: string;
  status: string;
  title: string;
  updatedAt: Date;
}

function normalizeTaskStatus(status: string): TaskStatus {
  switch (status) {
    case "draft":
      return "new";
    case "planned":
      return "implementation";
    case "error":
      return "new";
    case "new":
    case "planning":
    case "implementation":
    case "completed":
      return status;
    default:
      return "new";
  }
}

function toTaskRecord(row: TaskRow): TaskRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.projectName,
    title: row.title,
    description: row.description,
    status: normalizeTaskStatus(row.status),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export interface CreateTaskRecordInput {
  description: string;
  projectId: string;
  title: string;
}

export class TaskRepository {
  constructor(private readonly database: AppDatabase) {}

  async create(input: CreateTaskRecordInput): Promise<TaskRecord> {
    const now = new Date();
    const id = randomUUID();

    this.database
      .insert(tasksTable)
      .values({
        id,
        projectId: input.projectId,
        title: input.title,
        description: input.description,
        status: "new",
        createdAt: now,
        updatedAt: now
      })
      .run();

    const created = await this.getById(id);

    if (!created) {
      throw new Error("Task was created but could not be reloaded from the database.");
    }

    return created;
  }

  async getById(taskId: string, projectId?: string): Promise<TaskRecord | null> {
    const row = this.database
      .select({
        id: tasksTable.id,
        projectId: tasksTable.projectId,
        projectName: projectsTable.name,
        title: tasksTable.title,
        description: tasksTable.description,
        status: tasksTable.status,
        createdAt: tasksTable.createdAt,
        updatedAt: tasksTable.updatedAt
      })
      .from(tasksTable)
      .innerJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
      .where(
        projectId
          ? and(eq(tasksTable.id, taskId), eq(tasksTable.projectId, projectId))
          : eq(tasksTable.id, taskId)
      )
      .get();

    return row ? toTaskRecord(row) : null;
  }

  async delete(taskId: string): Promise<boolean> {
    const result = this.database.delete(tasksTable).where(eq(tasksTable.id, taskId)).run();

    return result.changes > 0;
  }

  async list(projectId?: string): Promise<TaskRecord[]> {
    const rows = this.database
      .select({
        id: tasksTable.id,
        projectId: tasksTable.projectId,
        projectName: projectsTable.name,
        title: tasksTable.title,
        description: tasksTable.description,
        status: tasksTable.status,
        createdAt: tasksTable.createdAt,
        updatedAt: tasksTable.updatedAt
      })
      .from(tasksTable)
      .innerJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
      .where(projectId ? eq(tasksTable.projectId, projectId) : undefined)
      .orderBy(desc(tasksTable.updatedAt))
      .all();

    return rows.map(toTaskRecord);
  }

  async touch(taskId: string): Promise<void> {
    this.database
      .update(tasksTable)
      .set({
        updatedAt: new Date()
      })
      .where(eq(tasksTable.id, taskId))
      .run();
  }

  async updateStatus(taskId: string, status: TaskStatus): Promise<void> {
    this.database
      .update(tasksTable)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(tasksTable.id, taskId))
      .run();
  }
}
