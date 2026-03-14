/*
Purpose: Persist and retrieve the current Markdown plan associated with a task.
Out of scope: Agent prompt construction, UI editing state, and task lifecycle orchestration.
*/
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { PlanRecord, PlanSource } from "../../shared/contracts/desktop-api";
import type { AppDatabase } from "./database";
import { plansTable } from "./schema";

function toPlanRecord(row: typeof plansTable.$inferSelect): PlanRecord {
  return {
    id: row.id,
    taskId: row.taskId,
    contentMd: row.contentMd,
    source: row.source as PlanSource,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export interface SavePlanRecordInput {
  contentMd: string;
  source: PlanSource;
  taskId: string;
}

export class PlanRepository {
  constructor(private readonly database: AppDatabase) {}

  async getByTaskId(taskId: string): Promise<PlanRecord | null> {
    const row = this.database.select().from(plansTable).where(eq(plansTable.taskId, taskId)).get();

    return row ? toPlanRecord(row) : null;
  }

  async save(input: SavePlanRecordInput): Promise<PlanRecord> {
    const now = new Date();
    const existing = this.database.select().from(plansTable).where(eq(plansTable.taskId, input.taskId)).get();

    if (existing) {
      this.database
        .update(plansTable)
        .set({
          contentMd: input.contentMd,
          source: input.source,
          updatedAt: now
        })
        .where(eq(plansTable.taskId, input.taskId))
        .run();
    } else {
      this.database
        .insert(plansTable)
        .values({
          id: randomUUID(),
          taskId: input.taskId,
          contentMd: input.contentMd,
          source: input.source,
          createdAt: now,
          updatedAt: now
        })
        .run();
    }

    const saved = await this.getByTaskId(input.taskId);

    if (!saved) {
      throw new Error("Plan was saved but could not be reloaded from the database.");
    }

    return saved;
  }
}
