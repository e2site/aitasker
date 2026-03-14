/*
Назначение: Управляет текущим планом задачи и историей MCP-ревизий Markdown-плана.
Не входит: Построение MCP prompt, renderer-состояние и orchestration жизненного цикла задач.
*/
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type {
  PlanRecord,
  PlanRevisionRecord,
  PlanSource,
  RestorePlanRevisionInput
} from "../../shared/contracts/desktop-api";
import type { AppDatabase } from "./database";
import { planRevisionsTable, plansTable } from "./schema";

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

function toPlanRevisionRecord(row: typeof planRevisionsTable.$inferSelect): PlanRevisionRecord {
  return {
    id: row.id,
    planId: row.planId,
    taskId: row.taskId,
    contentMd: row.contentMd,
    source: row.source as PlanSource,
    createdAt: row.createdAt.toISOString()
  };
}

async function insertRevision(
  database: AppDatabase,
  plan: typeof plansTable.$inferSelect
): Promise<PlanRevisionRecord> {
  const revisionId = randomUUID();

  database
    .insert(planRevisionsTable)
    .values({
      id: revisionId,
      planId: plan.id,
      taskId: plan.taskId,
      contentMd: plan.contentMd,
      source: plan.source,
      createdAt: new Date()
    })
    .run();

  const createdRevision = database
    .select()
    .from(planRevisionsTable)
    .where(eq(planRevisionsTable.id, revisionId))
    .get();

  if (!createdRevision) {
    throw new Error("Ревизия плана создана, но не удалось прочитать ее из базы.");
  }

  return toPlanRevisionRecord(createdRevision);
}

export interface SavePlanRecordInput {
  contentMd: string;
  createRevision?: boolean;
  source: PlanSource;
  taskId: string;
}

export class PlanRepository {
  constructor(private readonly database: AppDatabase) {}

  async getByTaskId(taskId: string): Promise<PlanRecord | null> {
    const row = this.database.select().from(plansTable).where(eq(plansTable.taskId, taskId)).get();

    return row ? toPlanRecord(row) : null;
  }

  async getRevisionById(revisionId: string): Promise<PlanRevisionRecord | null> {
    const row = this.database
      .select()
      .from(planRevisionsTable)
      .where(eq(planRevisionsTable.id, revisionId))
      .get();

    return row ? toPlanRevisionRecord(row) : null;
  }

  async listRevisions(taskId: string): Promise<PlanRevisionRecord[]> {
    const rows = this.database
      .select()
      .from(planRevisionsTable)
      .where(eq(planRevisionsTable.taskId, taskId))
      .orderBy(desc(planRevisionsTable.createdAt))
      .all();

    return rows.map(toPlanRevisionRecord);
  }

  async restoreRevision(input: RestorePlanRevisionInput): Promise<PlanRecord> {
    const revision = await this.getRevisionById(input.revisionId);

    if (!revision || revision.taskId !== input.taskId) {
      throw new Error(`Ревизия ${input.revisionId} для задачи ${input.taskId} не найдена.`);
    }

    const existing = this.database.select().from(plansTable).where(eq(plansTable.taskId, input.taskId)).get();

    if (!existing) {
      throw new Error(`Текущий план задачи ${input.taskId} не найден.`);
    }

    this.database
      .update(plansTable)
      .set({
        contentMd: revision.contentMd,
        source: revision.source,
        updatedAt: new Date()
      })
      .where(eq(plansTable.taskId, input.taskId))
      .run();

    const restored = await this.getByTaskId(input.taskId);

    if (!restored) {
      throw new Error("План восстановлен, но не удалось перечитать его из базы.");
    }

    return restored;
  }

  async save(input: SavePlanRecordInput): Promise<PlanRecord> {
    const now = new Date();
    const existing = this.database.select().from(plansTable).where(eq(plansTable.taskId, input.taskId)).get();

    if (existing) {
      const hasChanges = existing.contentMd !== input.contentMd || existing.source !== input.source;

      if (hasChanges && input.createRevision) {
        await insertRevision(this.database, existing);
      }

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
      throw new Error("План сохранен, но не удалось прочитать его из базы.");
    }

    return saved;
  }
}
