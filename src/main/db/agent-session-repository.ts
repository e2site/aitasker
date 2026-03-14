/*
Purpose: Persist the current planning session state for the single active agent run per task.
Out of scope: Provider SDK calls, MCP transport management, and UI concerns.
*/
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type {
  AgentProviderId,
  AgentSessionRecord,
  AgentSessionStatus
} from "../../shared/contracts/desktop-api";
import type { AppDatabase } from "./database";
import { agentSessionsTable } from "./schema";

function toAgentSessionRecord(row: typeof agentSessionsTable.$inferSelect): AgentSessionRecord {
  return {
    id: row.id,
    taskId: row.taskId,
    provider: row.provider as AgentProviderId,
    externalSessionId: row.externalSessionId ?? null,
    externalThreadId: row.externalThreadId ?? null,
    status: row.status as AgentSessionStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export interface UpsertAgentSessionInput {
  externalSessionId?: string | null;
  externalThreadId?: string | null;
  provider: AgentProviderId;
  status: AgentSessionStatus;
  taskId: string;
}

export class AgentSessionRepository {
  constructor(private readonly database: AppDatabase) {}

  async getByTaskId(taskId: string): Promise<AgentSessionRecord | null> {
    const row = this.database
      .select()
      .from(agentSessionsTable)
      .where(eq(agentSessionsTable.taskId, taskId))
      .get();

    return row ? toAgentSessionRecord(row) : null;
  }

  async upsert(input: UpsertAgentSessionInput): Promise<AgentSessionRecord> {
    const now = new Date();
    const existing = this.database
      .select()
      .from(agentSessionsTable)
      .where(eq(agentSessionsTable.taskId, input.taskId))
      .get();

    if (existing) {
      this.database
        .update(agentSessionsTable)
        .set({
          provider: input.provider,
          externalSessionId: input.externalSessionId ?? null,
          externalThreadId: input.externalThreadId ?? null,
          status: input.status,
          updatedAt: now
        })
        .where(eq(agentSessionsTable.taskId, input.taskId))
        .run();
    } else {
      this.database
        .insert(agentSessionsTable)
        .values({
          id: randomUUID(),
          taskId: input.taskId,
          provider: input.provider,
          externalSessionId: input.externalSessionId ?? null,
          externalThreadId: input.externalThreadId ?? null,
          status: input.status,
          createdAt: now,
          updatedAt: now
        })
        .run();
    }

    const session = await this.getByTaskId(input.taskId);

    if (!session) {
      throw new Error("Agent session was saved but could not be reloaded from the database.");
    }

    return session;
  }
}
