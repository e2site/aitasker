// src/main/index.ts
import { dirname, join as join3 } from "path";
import { fileURLToPath } from "url";

// src/main/agents/agent-registry.ts
function createAgentRegistry() {
  return {
    providers: ["mcp"]
  };
}

// src/main/db/agent-session-repository.ts
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";

// src/main/db/schema.ts
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
var projectsTable = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull().unique(),
  description: text("description").notNull(),
  rootPath: text("root_path"),
  languagesJson: text("languages_json").notNull(),
  skillFilePath: text("skill_file_path"),
  skillPrompt: text("skill_prompt").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});
var tasksTable = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});
var plansTable = sqliteTable("plans", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().unique().references(() => tasksTable.id, { onDelete: "cascade" }),
  contentMd: text("content_md").notNull(),
  source: text("source").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});
var planRevisionsTable = sqliteTable("plan_revisions", {
  id: text("id").primaryKey(),
  planId: text("plan_id").notNull().references(() => plansTable.id, { onDelete: "cascade" }),
  taskId: text("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  contentMd: text("content_md").notNull(),
  source: text("source").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
});
var agentSessionsTable = sqliteTable("agent_sessions", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().unique().references(() => tasksTable.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  externalSessionId: text("external_session_id"),
  externalThreadId: text("external_thread_id"),
  status: text("status").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});
var taskLinksTable = sqliteTable("task_links", {
  id: text("id").primaryKey(),
  sourceTaskId: text("source_task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  targetTaskId: text("target_task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  comment: text("comment").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
});
var promptOverridesTable = sqliteTable("prompt_overrides", {
  id: text("id").primaryKey(),
  template: text("template").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});
var resourcesTable = sqliteTable("resources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  contentMd: text("content_md").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});
var taskResourcesTable = sqliteTable("task_resources", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  resourceId: text("resource_id").notNull().references(() => resourcesTable.id, { onDelete: "cascade" }),
  comment: text("comment").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
});
var planCommentsTable = sqliteTable("plan_comments", {
  id: text("id").primaryKey(),
  planId: text("plan_id").notNull().references(() => plansTable.id, { onDelete: "cascade" }),
  taskId: text("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  // "discussion" | "extension" | "improvement"
  author: text("author").notNull(),
  // "human" | "agent"
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});
var planQuestionsTable = sqliteTable("plan_questions", {
  id: text("id").primaryKey(),
  planId: text("plan_id").notNull().references(() => plansTable.id, { onDelete: "cascade" }),
  taskId: text("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  answer: text("answer"),
  answeredAt: integer("answered_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});
var taskGoalsTable = sqliteTable("task_goals", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  value: text("value").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});
var taskCriticalConditionsTable = sqliteTable("task_critical_conditions", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  value: text("value").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});
var taskForbiddenInterpretationsTable = sqliteTable("task_forbidden_interpretations", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  value: text("value").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});
var taskAcceptanceCriteriaTable = sqliteTable("task_acceptance_criteria", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  value: text("value").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});
var databaseSchema = {
  agentSessionsTable,
  planCommentsTable,
  planQuestionsTable,
  planRevisionsTable,
  plansTable,
  projectsTable,
  promptOverridesTable,
  resourcesTable,
  taskAcceptanceCriteriaTable,
  taskCriticalConditionsTable,
  taskForbiddenInterpretationsTable,
  taskGoalsTable,
  taskLinksTable,
  taskResourcesTable,
  tasksTable
};

// src/main/db/agent-session-repository.ts
function toAgentSessionRecord(row) {
  return {
    id: row.id,
    taskId: row.taskId,
    provider: row.provider,
    externalSessionId: row.externalSessionId ?? null,
    externalThreadId: row.externalThreadId ?? null,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}
var AgentSessionRepository = class {
  constructor(database) {
    this.database = database;
  }
  async getByTaskId(taskId) {
    const row = this.database.select().from(agentSessionsTable).where(eq(agentSessionsTable.taskId, taskId)).get();
    return row ? toAgentSessionRecord(row) : null;
  }
  async upsert(input) {
    const now = /* @__PURE__ */ new Date();
    const existing = this.database.select().from(agentSessionsTable).where(eq(agentSessionsTable.taskId, input.taskId)).get();
    if (existing) {
      this.database.update(agentSessionsTable).set({
        provider: input.provider,
        externalSessionId: input.externalSessionId ?? null,
        externalThreadId: input.externalThreadId ?? null,
        status: input.status,
        updatedAt: now
      }).where(eq(agentSessionsTable.taskId, input.taskId)).run();
    } else {
      this.database.insert(agentSessionsTable).values({
        id: randomUUID(),
        taskId: input.taskId,
        provider: input.provider,
        externalSessionId: input.externalSessionId ?? null,
        externalThreadId: input.externalThreadId ?? null,
        status: input.status,
        createdAt: now,
        updatedAt: now
      }).run();
    }
    const session = await this.getByTaskId(input.taskId);
    if (!session) {
      throw new Error("Agent session was saved but could not be reloaded from the database.");
    }
    return session;
  }
};

// src/main/db/database.ts
import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { join } from "path";
import { drizzle } from "drizzle-orm/better-sqlite3";

// src/main/db/bootstrap-database.ts
var DEFAULT_PROJECT_ID = "project-general";
var DEFAULT_PROJECT_NAME = "\u041E\u0431\u0449\u0435\u0435";
var DEFAULT_PROJECT_NORMALIZED_NAME = "\u043E\u0431\u0449\u0435\u0435";
var DEFAULT_PROJECT_DESCRIPTION = "";
var DEFAULT_PROJECT_LANGUAGES_JSON = "[]";
var DEFAULT_PROJECT_SKILL_PROMPT = "";
function hasColumn(sqlite, tableName, columnName) {
  const rows = sqlite.prepare(`PRAGMA table_info(${tableName})`).all();
  return rows.some((row) => row.name === columnName);
}
function bootstrapDatabase(sqlite) {
  sqlite.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      root_path TEXT,
      languages_json TEXT NOT NULL DEFAULT '[]',
      skill_file_path TEXT,
      skill_prompt TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL UNIQUE,
      content_md TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS plan_revisions (
      id TEXT PRIMARY KEY NOT NULL,
      plan_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      content_md TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agent_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL,
      external_session_id TEXT,
      external_thread_id TEXT,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS task_links (
      id TEXT PRIMARY KEY NOT NULL,
      source_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      target_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      comment TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prompt_overrides (
      id TEXT PRIMARY KEY NOT NULL,
      template TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS resources (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      content_md TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_resources (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
      comment TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plan_comments (
      id TEXT PRIMARY KEY NOT NULL,
      plan_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      author TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS plan_questions (
      id TEXT PRIMARY KEY NOT NULL,
      plan_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      content TEXT NOT NULL,
      answer TEXT,
      answered_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS task_goals (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      value TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_critical_conditions (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      value TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_forbidden_interpretations (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      value TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_acceptance_criteria (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      value TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  if (!hasColumn(sqlite, "tasks", "project_id")) {
    sqlite.exec(`ALTER TABLE tasks ADD COLUMN project_id TEXT;`);
  }
  if (!hasColumn(sqlite, "projects", "description")) {
    sqlite.exec(`ALTER TABLE projects ADD COLUMN description TEXT NOT NULL DEFAULT '';`);
  }
  if (!hasColumn(sqlite, "projects", "root_path")) {
    sqlite.exec(`ALTER TABLE projects ADD COLUMN root_path TEXT;`);
  }
  if (!hasColumn(sqlite, "projects", "languages_json")) {
    sqlite.exec(`ALTER TABLE projects ADD COLUMN languages_json TEXT NOT NULL DEFAULT '[]';`);
  }
  if (!hasColumn(sqlite, "projects", "skill_file_path")) {
    sqlite.exec(`ALTER TABLE projects ADD COLUMN skill_file_path TEXT;`);
  }
  if (!hasColumn(sqlite, "projects", "skill_prompt")) {
    sqlite.exec(`ALTER TABLE projects ADD COLUMN skill_prompt TEXT NOT NULL DEFAULT '';`);
  }
  const now = Date.now();
  sqlite.prepare(
    `
        INSERT OR IGNORE INTO projects (
          id,
          name,
          normalized_name,
          description,
          root_path,
          languages_json,
          skill_file_path,
          skill_prompt,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
  ).run(
    DEFAULT_PROJECT_ID,
    DEFAULT_PROJECT_NAME,
    DEFAULT_PROJECT_NORMALIZED_NAME,
    DEFAULT_PROJECT_DESCRIPTION,
    null,
    DEFAULT_PROJECT_LANGUAGES_JSON,
    null,
    DEFAULT_PROJECT_SKILL_PROMPT,
    now,
    now
  );
  sqlite.prepare(
    `
        UPDATE tasks
        SET project_id = ?
        WHERE project_id IS NULL OR TRIM(project_id) = ''
      `
  ).run(DEFAULT_PROJECT_ID);
  sqlite.prepare(
    `
        UPDATE tasks
        SET status = CASE
          WHEN status = 'draft' THEN 'new'
          WHEN status = 'planned' THEN 'implementation'
          WHEN status = 'error' THEN 'new'
          ELSE status
        END
        WHERE status IN ('draft', 'planned', 'error')
      `
  ).run();
  sqlite.prepare(
    `
        UPDATE projects
        SET
          description = COALESCE(description, ''),
          languages_json = COALESCE(NULLIF(languages_json, ''), '[]'),
          skill_prompt = COALESCE(skill_prompt, '')
      `
  ).run();
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_plan_revisions_task_id ON plan_revisions(task_id);
    CREATE INDEX IF NOT EXISTS idx_plan_revisions_plan_id ON plan_revisions(plan_id);
    CREATE INDEX IF NOT EXISTS idx_task_links_source_task_id ON task_links(source_task_id);
    CREATE INDEX IF NOT EXISTS idx_task_links_target_task_id ON task_links(target_task_id);
    CREATE INDEX IF NOT EXISTS idx_task_resources_task_id ON task_resources(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_resources_resource_id ON task_resources(resource_id);
    CREATE INDEX IF NOT EXISTS idx_plan_comments_task_id ON plan_comments(task_id);
    CREATE INDEX IF NOT EXISTS idx_plan_comments_plan_id ON plan_comments(plan_id);
    CREATE INDEX IF NOT EXISTS idx_plan_questions_task_id ON plan_questions(task_id);
    CREATE INDEX IF NOT EXISTS idx_plan_questions_plan_id ON plan_questions(plan_id);
    CREATE INDEX IF NOT EXISTS idx_task_goals_task_id ON task_goals(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_critical_conditions_task_id ON task_critical_conditions(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_forbidden_interpretations_task_id ON task_forbidden_interpretations(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_acceptance_criteria_task_id ON task_acceptance_criteria(task_id);
  `);
}

// src/main/db/database.ts
function createAppDatabase(userDataPath) {
  mkdirSync(userDataPath, { recursive: true });
  const databasePath = join(userDataPath, "aitasker.sqlite");
  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  bootstrapDatabase(sqlite);
  return {
    database: drizzle(sqlite, { schema: databaseSchema }),
    databasePath,
    sqlite
  };
}

// src/main/db/plan-comment-repository.ts
import { randomUUID as randomUUID2 } from "crypto";
import { and, eq as eq2 } from "drizzle-orm";
function toCommentRecord(row) {
  return {
    id: row.id,
    planId: row.planId,
    taskId: row.taskId,
    kind: row.kind,
    author: row.author,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}
function toQuestionRecord(row) {
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
var PlanCommentRepository = class {
  constructor(database) {
    this.database = database;
  }
  // ─── Comments ───────────────────────────────────────────────────────────────
  async addComment(input) {
    const id = randomUUID2();
    const now = /* @__PURE__ */ new Date();
    this.database.insert(planCommentsTable).values({ id, ...input, createdAt: now, updatedAt: now }).run();
    const row = this.database.select().from(planCommentsTable).where(eq2(planCommentsTable.id, id)).get();
    if (!row) throw new Error(`PlanComment ${id} not found after insert.`);
    return toCommentRecord(row);
  }
  async listCommentsByTaskId(taskId) {
    const rows = this.database.select().from(planCommentsTable).where(eq2(planCommentsTable.taskId, taskId)).all();
    return rows.map(toCommentRecord);
  }
  async deleteCommentsByPlanId(planId) {
    this.database.delete(planCommentsTable).where(eq2(planCommentsTable.planId, planId)).run();
  }
  // ─── Questions ───────────────────────────────────────────────────────────────
  async addQuestion(input) {
    const id = randomUUID2();
    const now = /* @__PURE__ */ new Date();
    this.database.insert(planQuestionsTable).values({ id, ...input, answer: null, answeredAt: null, createdAt: now, updatedAt: now }).run();
    const row = this.database.select().from(planQuestionsTable).where(eq2(planQuestionsTable.id, id)).get();
    if (!row) throw new Error(`PlanQuestion ${id} not found after insert.`);
    return toQuestionRecord(row);
  }
  async answerQuestion(questionId, answer) {
    const now = /* @__PURE__ */ new Date();
    this.database.update(planQuestionsTable).set({ answer, answeredAt: now, updatedAt: now }).where(eq2(planQuestionsTable.id, questionId)).run();
    const row = this.database.select().from(planQuestionsTable).where(eq2(planQuestionsTable.id, questionId)).get();
    if (!row) throw new Error(`PlanQuestion ${questionId} not found after update.`);
    return toQuestionRecord(row);
  }
  async listQuestionsByTaskId(taskId) {
    const rows = this.database.select().from(planQuestionsTable).where(eq2(planQuestionsTable.taskId, taskId)).all();
    return rows.map(toQuestionRecord);
  }
  async getQuestionById(questionId) {
    const row = this.database.select().from(planQuestionsTable).where(eq2(planQuestionsTable.id, questionId)).get();
    return row ? toQuestionRecord(row) : null;
  }
  async deleteQuestionsByPlanId(planId) {
    this.database.delete(planQuestionsTable).where(eq2(planQuestionsTable.planId, planId)).run();
  }
  async deleteOpenQuestionsByPlanId(planId) {
    this.database.delete(planQuestionsTable).where(
      and(eq2(planQuestionsTable.planId, planId), eq2(planQuestionsTable.answeredAt, null))
    ).run();
  }
};

// src/main/db/plan-repository.ts
import { randomUUID as randomUUID3 } from "crypto";
import { desc, eq as eq3 } from "drizzle-orm";
function toPlanRecord(row) {
  return {
    id: row.id,
    taskId: row.taskId,
    contentMd: row.contentMd,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}
function toPlanRevisionRecord(row) {
  return {
    id: row.id,
    planId: row.planId,
    taskId: row.taskId,
    contentMd: row.contentMd,
    source: row.source,
    createdAt: row.createdAt.toISOString()
  };
}
async function insertRevision(database, plan) {
  const revisionId = randomUUID3();
  database.insert(planRevisionsTable).values({
    id: revisionId,
    planId: plan.id,
    taskId: plan.taskId,
    contentMd: plan.contentMd,
    source: plan.source,
    createdAt: /* @__PURE__ */ new Date()
  }).run();
  const createdRevision = database.select().from(planRevisionsTable).where(eq3(planRevisionsTable.id, revisionId)).get();
  if (!createdRevision) {
    throw new Error("\u0420\u0435\u0432\u0438\u0437\u0438\u044F \u043F\u043B\u0430\u043D\u0430 \u0441\u043E\u0437\u0434\u0430\u043D\u0430, \u043D\u043E \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0435\u0435 \u0438\u0437 \u0431\u0430\u0437\u044B.");
  }
  return toPlanRevisionRecord(createdRevision);
}
var PlanRepository = class {
  constructor(database) {
    this.database = database;
  }
  async getByTaskId(taskId) {
    const row = this.database.select().from(plansTable).where(eq3(plansTable.taskId, taskId)).get();
    return row ? toPlanRecord(row) : null;
  }
  async getRevisionById(revisionId) {
    const row = this.database.select().from(planRevisionsTable).where(eq3(planRevisionsTable.id, revisionId)).get();
    return row ? toPlanRevisionRecord(row) : null;
  }
  async listRevisions(taskId) {
    const rows = this.database.select().from(planRevisionsTable).where(eq3(planRevisionsTable.taskId, taskId)).orderBy(desc(planRevisionsTable.createdAt)).all();
    return rows.map(toPlanRevisionRecord);
  }
  async restoreRevision(input) {
    const revision = await this.getRevisionById(input.revisionId);
    if (!revision || revision.taskId !== input.taskId) {
      throw new Error(`\u0420\u0435\u0432\u0438\u0437\u0438\u044F ${input.revisionId} \u0434\u043B\u044F \u0437\u0430\u0434\u0430\u0447\u0438 ${input.taskId} \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430.`);
    }
    const existing = this.database.select().from(plansTable).where(eq3(plansTable.taskId, input.taskId)).get();
    if (!existing) {
      throw new Error(`\u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u043F\u043B\u0430\u043D \u0437\u0430\u0434\u0430\u0447\u0438 ${input.taskId} \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D.`);
    }
    this.database.update(plansTable).set({
      contentMd: revision.contentMd,
      source: revision.source,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq3(plansTable.taskId, input.taskId)).run();
    const restored = await this.getByTaskId(input.taskId);
    if (!restored) {
      throw new Error("\u041F\u043B\u0430\u043D \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D, \u043D\u043E \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0435\u0440\u0435\u0447\u0438\u0442\u0430\u0442\u044C \u0435\u0433\u043E \u0438\u0437 \u0431\u0430\u0437\u044B.");
    }
    return restored;
  }
  async save(input) {
    const now = /* @__PURE__ */ new Date();
    const existing = this.database.select().from(plansTable).where(eq3(plansTable.taskId, input.taskId)).get();
    if (existing) {
      const hasChanges = existing.contentMd !== input.contentMd || existing.source !== input.source;
      if (hasChanges && input.createRevision) {
        await insertRevision(this.database, existing);
      }
      this.database.update(plansTable).set({
        contentMd: input.contentMd,
        source: input.source,
        updatedAt: now
      }).where(eq3(plansTable.taskId, input.taskId)).run();
    } else {
      this.database.insert(plansTable).values({
        id: randomUUID3(),
        taskId: input.taskId,
        contentMd: input.contentMd,
        source: input.source,
        createdAt: now,
        updatedAt: now
      }).run();
    }
    const saved = await this.getByTaskId(input.taskId);
    if (!saved) {
      throw new Error("\u041F\u043B\u0430\u043D \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D, \u043D\u043E \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0435\u0433\u043E \u0438\u0437 \u0431\u0430\u0437\u044B.");
    }
    return saved;
  }
};

// src/main/db/project-repository.ts
import { randomUUID as randomUUID4 } from "crypto";
import { desc as desc2, eq as eq4 } from "drizzle-orm";
function normalizeWhitespace(value) {
  return value.trim().replace(/\s+/g, " ");
}
function normalizeLanguages(languages) {
  return Array.from(
    new Set(
      languages.map((language) => normalizeWhitespace(language)).filter((language) => language.length > 0)
    )
  ).sort((left, right) => left.localeCompare(right, "ru-RU"));
}
function buildDefaultSkillPrompt(projectName) {
  return `\u0421\u043E\u0437\u0434\u0430\u0439 \u0438\u043B\u0438 \u043E\u0431\u043D\u043E\u0432\u0438 SKILL.md \u0434\u043B\u044F \u043F\u0440\u043E\u0435\u043A\u0442\u0430 "${projectName}". \u041E\u043F\u0438\u0448\u0438 \u0442\u0438\u043F\u043E\u0432\u044B\u0435 workflow, \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u044F, \u0441\u043E\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u044F \u043F\u043E \u043A\u043E\u0434\u0443 \u0438 \u0448\u0430\u0433\u0438 \u0434\u043B\u044F \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u044F \u0437\u0430\u0434\u0430\u0447 \u043F\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0443.`;
}
function isProfileComplete(row) {
  return Boolean(row.description.trim() && row.rootPath?.trim() && parseLanguages(row.languagesJson).length > 0);
}
function parseLanguages(languagesJson) {
  try {
    const parsed = JSON.parse(languagesJson);
    return Array.isArray(parsed) ? normalizeLanguages(parsed.filter((value) => typeof value === "string")) : [];
  } catch {
    return [];
  }
}
function toProjectRecord(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    rootPath: row.rootPath,
    languages: parseLanguages(row.languagesJson),
    skillFilePath: row.skillFilePath,
    skillPrompt: row.skillPrompt,
    isProfileComplete: isProfileComplete(row),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}
function normalizeProjectName(name) {
  return normalizeWhitespace(name).toLocaleLowerCase("ru-RU");
}
function sanitizeProjectName(name) {
  return normalizeWhitespace(name);
}
var ProjectRepository = class {
  constructor(database) {
    this.database = database;
  }
  async create(input) {
    const existing = await this.findByName(input.name);
    if (existing) {
      return existing;
    }
    const now = /* @__PURE__ */ new Date();
    const sanitizedName = sanitizeProjectName(input.name);
    const id = randomUUID4();
    this.database.insert(projectsTable).values({
      id,
      name: sanitizedName,
      normalizedName: normalizeProjectName(sanitizedName),
      description: "",
      rootPath: null,
      languagesJson: "[]",
      skillFilePath: null,
      skillPrompt: buildDefaultSkillPrompt(sanitizedName),
      createdAt: now,
      updatedAt: now
    }).run();
    const created = await this.getById(id);
    if (!created) {
      throw new Error("\u041F\u0440\u043E\u0435\u043A\u0442 \u0441\u043E\u0437\u0434\u0430\u043D, \u043D\u043E \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0435\u0433\u043E \u0438\u0437 \u0431\u0430\u0437\u044B.");
    }
    return created;
  }
  async findByName(name) {
    const row = this.database.select().from(projectsTable).where(eq4(projectsTable.normalizedName, normalizeProjectName(name))).get();
    return row ? toProjectRecord(row) : null;
  }
  async getById(projectId) {
    const row = this.database.select().from(projectsTable).where(eq4(projectsTable.id, projectId)).get();
    return row ? toProjectRecord(row) : null;
  }
  async list() {
    const rows = this.database.select().from(projectsTable).orderBy(desc2(projectsTable.updatedAt), desc2(projectsTable.createdAt)).all();
    return rows.map(toProjectRecord);
  }
  async touch(projectId) {
    this.database.update(projectsTable).set({
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq4(projectsTable.id, projectId)).run();
  }
  async updateProfile(input) {
    const existing = this.database.select().from(projectsTable).where(eq4(projectsTable.id, input.projectId)).get();
    if (!existing) {
      throw new Error(`\u041F\u0440\u043E\u0435\u043A\u0442 ${input.projectId} \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D.`);
    }
    const nextName = input.name ? sanitizeProjectName(input.name) : existing.name;
    const nextDescription = input.description !== void 0 ? input.description.trim() : existing.description;
    const nextRootPath = input.rootPath !== void 0 ? input.rootPath ? input.rootPath.trim() : null : existing.rootPath;
    const nextLanguages = input.languages !== void 0 ? JSON.stringify(normalizeLanguages(input.languages)) : existing.languagesJson;
    const nextSkillFilePath = input.skillFilePath !== void 0 ? input.skillFilePath ? input.skillFilePath.trim() : null : existing.skillFilePath;
    const nextSkillPrompt = input.skillPrompt !== void 0 ? input.skillPrompt.trim() : existing.skillPrompt || buildDefaultSkillPrompt(nextName);
    this.database.update(projectsTable).set({
      name: nextName,
      normalizedName: normalizeProjectName(nextName),
      description: nextDescription,
      rootPath: nextRootPath,
      languagesJson: nextLanguages,
      skillFilePath: nextSkillFilePath,
      skillPrompt: nextSkillPrompt,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq4(projectsTable.id, input.projectId)).run();
    const updated = await this.getById(input.projectId);
    if (!updated) {
      throw new Error(`\u041F\u0440\u043E\u0435\u043A\u0442 ${input.projectId} \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D, \u043D\u043E \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0435\u0440\u0435\u0447\u0438\u0442\u0430\u0442\u044C \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443.`);
    }
    return updated;
  }
};

// src/main/db/prompt-override-repository.ts
import { eq as eq5 } from "drizzle-orm";
var PromptOverrideRepository = class {
  constructor(db) {
    this.db = db;
  }
  upsert(id, template) {
    const now = Date.now();
    const existing = this.db.select().from(promptOverridesTable).where(eq5(promptOverridesTable.id, id)).all();
    if (existing.length > 0) {
      this.db.update(promptOverridesTable).set({ template, updatedAt: new Date(now) }).where(eq5(promptOverridesTable.id, id)).run();
    } else {
      this.db.insert(promptOverridesTable).values({ id, template, createdAt: new Date(now), updatedAt: new Date(now) }).run();
    }
    return this.toRecord(id, template, existing[0]?.createdAt ?? new Date(now), new Date(now));
  }
  getById(id) {
    const rows = this.db.select().from(promptOverridesTable).where(eq5(promptOverridesTable.id, id)).all();
    if (rows.length === 0) return null;
    const row = rows[0];
    return this.toRecord(row.id, row.template, row.createdAt, row.updatedAt);
  }
  list() {
    return this.db.select().from(promptOverridesTable).all().map((row) => this.toRecord(row.id, row.template, row.createdAt, row.updatedAt));
  }
  delete(id) {
    const result = this.db.delete(promptOverridesTable).where(eq5(promptOverridesTable.id, id)).run();
    return result.changes > 0;
  }
  toRecord(id, template, createdAt, updatedAt) {
    return {
      id,
      template,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString()
    };
  }
};

// src/main/db/resource-repository.ts
import { randomUUID as randomUUID5 } from "crypto";
import { desc as desc3, eq as eq6 } from "drizzle-orm";
function mapRow(row) {
  return {
    id: row.id,
    name: row.name,
    contentMd: row.contentMd,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}
var ResourceRepository = class {
  constructor(database) {
    this.database = database;
  }
  async create(input) {
    const id = randomUUID5();
    const now = /* @__PURE__ */ new Date();
    this.database.insert(resourcesTable).values({
      id,
      name: input.name,
      contentMd: input.contentMd ?? "",
      createdAt: now,
      updatedAt: now
    }).run();
    const row = this.database.select().from(resourcesTable).where(eq6(resourcesTable.id, id)).get();
    if (!row) {
      throw new Error(`Resource ${id} not found after create.`);
    }
    return mapRow(row);
  }
  async getById(id) {
    const row = this.database.select().from(resourcesTable).where(eq6(resourcesTable.id, id)).get();
    return row ? mapRow(row) : void 0;
  }
  async list() {
    const rows = this.database.select().from(resourcesTable).orderBy(desc3(resourcesTable.updatedAt)).all();
    return rows.map(mapRow);
  }
  async update(id, input) {
    const now = /* @__PURE__ */ new Date();
    this.database.update(resourcesTable).set({
      ...input.name !== void 0 ? { name: input.name } : {},
      ...input.contentMd !== void 0 ? { contentMd: input.contentMd } : {},
      updatedAt: now
    }).where(eq6(resourcesTable.id, id)).run();
    const row = this.database.select().from(resourcesTable).where(eq6(resourcesTable.id, id)).get();
    if (!row) {
      throw new Error(`Resource ${id} not found.`);
    }
    return mapRow(row);
  }
  async delete(id) {
    this.database.delete(resourcesTable).where(eq6(resourcesTable.id, id)).run();
  }
};

// src/main/db/task-link-repository.ts
import { randomUUID as randomUUID6 } from "crypto";
import { eq as eq7, or } from "drizzle-orm";
var TaskLinkRepository = class {
  constructor(database) {
    this.database = database;
  }
  async create(input) {
    const id = randomUUID6();
    const now = /* @__PURE__ */ new Date();
    this.database.insert(taskLinksTable).values({
      id,
      sourceTaskId: input.sourceTaskId,
      targetTaskId: input.targetTaskId,
      comment: input.comment,
      createdAt: now
    }).run();
    return {
      id,
      sourceTaskId: input.sourceTaskId,
      targetTaskId: input.targetTaskId,
      comment: input.comment,
      createdAt: now.toISOString()
    };
  }
  async listByTaskId(taskId) {
    const rows = this.database.select({
      linkId: taskLinksTable.id,
      sourceTaskId: taskLinksTable.sourceTaskId,
      targetTaskId: taskLinksTable.targetTaskId,
      comment: taskLinksTable.comment,
      createdAt: taskLinksTable.createdAt,
      linkedTaskId: tasksTable.id,
      linkedTaskTitle: tasksTable.title,
      linkedTaskStatus: tasksTable.status,
      linkedProjectName: projectsTable.name
    }).from(taskLinksTable).innerJoin(
      tasksTable,
      or(
        eq7(taskLinksTable.targetTaskId, tasksTable.id),
        eq7(taskLinksTable.sourceTaskId, tasksTable.id)
      )
    ).innerJoin(projectsTable, eq7(tasksTable.projectId, projectsTable.id)).where(or(eq7(taskLinksTable.sourceTaskId, taskId), eq7(taskLinksTable.targetTaskId, taskId))).all();
    const result = [];
    for (const row of rows) {
      if (row.linkedTaskId === taskId) {
        continue;
      }
      const direction = row.sourceTaskId === taskId ? "outgoing" : "incoming";
      result.push({
        id: row.linkId,
        taskId: row.linkedTaskId,
        title: row.linkedTaskTitle,
        status: row.linkedTaskStatus,
        projectName: row.linkedProjectName,
        comment: row.comment,
        direction,
        createdAt: row.createdAt.toISOString()
      });
    }
    return result;
  }
  async delete(linkId) {
    const result = this.database.delete(taskLinksTable).where(eq7(taskLinksTable.id, linkId)).run();
    return result.changes > 0;
  }
};

// src/main/db/task-repository.ts
import { randomUUID as randomUUID7 } from "crypto";
import { and as and2, desc as desc4, eq as eq8 } from "drizzle-orm";
function normalizeTaskStatus(status) {
  switch (status) {
    case "draft":
      return "new";
    case "planned":
      return "implementation";
    case "error":
      return "new";
    case "new":
    case "planning":
    case "requires_clarification":
    case "implementation":
    case "testing":
    case "completed":
      return status;
    default:
      return "new";
  }
}
function toTaskRecord(row) {
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.projectName,
    title: row.title,
    description: row.description,
    status: normalizeTaskStatus(row.status),
    planContentMd: row.planContentMd ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}
var TaskRepository = class {
  constructor(database) {
    this.database = database;
  }
  async create(input) {
    const now = /* @__PURE__ */ new Date();
    const id = randomUUID7();
    this.database.insert(tasksTable).values({
      id,
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      status: "new",
      createdAt: now,
      updatedAt: now
    }).run();
    const created = await this.getById(id);
    if (!created) {
      throw new Error("Task was created but could not be reloaded from the database.");
    }
    return created;
  }
  async getById(taskId, projectId) {
    const row = this.database.select({
      id: tasksTable.id,
      projectId: tasksTable.projectId,
      projectName: projectsTable.name,
      title: tasksTable.title,
      description: tasksTable.description,
      status: tasksTable.status,
      planContentMd: plansTable.contentMd,
      createdAt: tasksTable.createdAt,
      updatedAt: tasksTable.updatedAt
    }).from(tasksTable).innerJoin(projectsTable, eq8(tasksTable.projectId, projectsTable.id)).leftJoin(plansTable, eq8(plansTable.taskId, tasksTable.id)).where(
      projectId ? and2(eq8(tasksTable.id, taskId), eq8(tasksTable.projectId, projectId)) : eq8(tasksTable.id, taskId)
    ).get();
    return row ? toTaskRecord(row) : null;
  }
  async delete(taskId) {
    const result = this.database.delete(tasksTable).where(eq8(tasksTable.id, taskId)).run();
    return result.changes > 0;
  }
  async list(projectId) {
    const rows = this.database.select({
      id: tasksTable.id,
      projectId: tasksTable.projectId,
      projectName: projectsTable.name,
      title: tasksTable.title,
      description: tasksTable.description,
      status: tasksTable.status,
      planContentMd: plansTable.contentMd,
      createdAt: tasksTable.createdAt,
      updatedAt: tasksTable.updatedAt
    }).from(tasksTable).innerJoin(projectsTable, eq8(tasksTable.projectId, projectsTable.id)).leftJoin(plansTable, eq8(plansTable.taskId, tasksTable.id)).where(projectId ? eq8(tasksTable.projectId, projectId) : void 0).orderBy(desc4(tasksTable.updatedAt)).all();
    return rows.map(toTaskRecord);
  }
  async touch(taskId) {
    this.database.update(tasksTable).set({
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq8(tasksTable.id, taskId)).run();
  }
  async update(taskId, fields) {
    this.database.update(tasksTable).set({ ...fields, updatedAt: /* @__PURE__ */ new Date() }).where(eq8(tasksTable.id, taskId)).run();
  }
  async updateStatus(taskId, status) {
    this.database.update(tasksTable).set({
      status,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq8(tasksTable.id, taskId)).run();
  }
};

// src/main/db/task-context-repository.ts
import { randomUUID as randomUUID8 } from "crypto";
import { asc, eq as eq9 } from "drizzle-orm";
function createEmptyTaskContext() {
  return {
    goal: [],
    criticalConditions: [],
    forbiddenInterpretations: [],
    acceptanceCriteria: []
  };
}
var TaskContextRepository = class {
  constructor(database) {
    this.database = database;
  }
  async getByTaskId(taskId) {
    const [goalRows, criticalRows, forbiddenRows, acceptanceRows] = await Promise.all([
      this.database.select().from(taskGoalsTable).where(eq9(taskGoalsTable.taskId, taskId)).orderBy(asc(taskGoalsTable.createdAt)).all(),
      this.database.select().from(taskCriticalConditionsTable).where(eq9(taskCriticalConditionsTable.taskId, taskId)).orderBy(asc(taskCriticalConditionsTable.createdAt)).all(),
      this.database.select().from(taskForbiddenInterpretationsTable).where(eq9(taskForbiddenInterpretationsTable.taskId, taskId)).orderBy(asc(taskForbiddenInterpretationsTable.createdAt)).all(),
      this.database.select().from(taskAcceptanceCriteriaTable).where(eq9(taskAcceptanceCriteriaTable.taskId, taskId)).orderBy(asc(taskAcceptanceCriteriaTable.createdAt)).all()
    ]);
    const result = createEmptyTaskContext();
    result.goal = goalRows.map((row) => row.value);
    result.criticalConditions = criticalRows.map((row) => row.value);
    result.forbiddenInterpretations = forbiddenRows.map((row) => row.value);
    result.acceptanceCriteria = acceptanceRows.map((row) => row.value);
    return result;
  }
  async replaceByTaskId(taskId, input) {
    const now = /* @__PURE__ */ new Date();
    this.database.transaction((tx) => {
      tx.delete(taskGoalsTable).where(eq9(taskGoalsTable.taskId, taskId)).run();
      tx.delete(taskCriticalConditionsTable).where(eq9(taskCriticalConditionsTable.taskId, taskId)).run();
      tx.delete(taskForbiddenInterpretationsTable).where(eq9(taskForbiddenInterpretationsTable.taskId, taskId)).run();
      tx.delete(taskAcceptanceCriteriaTable).where(eq9(taskAcceptanceCriteriaTable.taskId, taskId)).run();
      for (const value of input.goal) {
        tx.insert(taskGoalsTable).values({ id: randomUUID8(), taskId, value, createdAt: now, updatedAt: now }).run();
      }
      for (const value of input.criticalConditions) {
        tx.insert(taskCriticalConditionsTable).values({ id: randomUUID8(), taskId, value, createdAt: now, updatedAt: now }).run();
      }
      for (const value of input.forbiddenInterpretations) {
        tx.insert(taskForbiddenInterpretationsTable).values({ id: randomUUID8(), taskId, value, createdAt: now, updatedAt: now }).run();
      }
      for (const value of input.acceptanceCriteria) {
        tx.insert(taskAcceptanceCriteriaTable).values({ id: randomUUID8(), taskId, value, createdAt: now, updatedAt: now }).run();
      }
    });
  }
};

// src/main/db/task-resource-repository.ts
import { randomUUID as randomUUID9 } from "crypto";
import { eq as eq10 } from "drizzle-orm";
var TaskResourceRepository = class {
  constructor(database) {
    this.database = database;
  }
  async link(input) {
    const id = randomUUID9();
    const now = /* @__PURE__ */ new Date();
    this.database.insert(taskResourcesTable).values({
      id,
      taskId: input.taskId,
      resourceId: input.resourceId,
      comment: input.comment,
      createdAt: now
    }).run();
    const row = this.database.select({
      linkId: taskResourcesTable.id,
      resourceId: taskResourcesTable.resourceId,
      comment: taskResourcesTable.comment,
      createdAt: taskResourcesTable.createdAt,
      name: resourcesTable.name,
      contentMd: resourcesTable.contentMd
    }).from(taskResourcesTable).innerJoin(resourcesTable, eq10(taskResourcesTable.resourceId, resourcesTable.id)).where(eq10(taskResourcesTable.id, id)).get();
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
  async listByTaskId(taskId) {
    const rows = this.database.select({
      linkId: taskResourcesTable.id,
      resourceId: taskResourcesTable.resourceId,
      comment: taskResourcesTable.comment,
      createdAt: taskResourcesTable.createdAt,
      name: resourcesTable.name,
      contentMd: resourcesTable.contentMd
    }).from(taskResourcesTable).innerJoin(resourcesTable, eq10(taskResourcesTable.resourceId, resourcesTable.id)).where(eq10(taskResourcesTable.taskId, taskId)).all();
    return rows.map((row) => ({
      id: row.linkId,
      resourceId: row.resourceId,
      name: row.name,
      contentMd: row.contentMd,
      comment: row.comment,
      createdAt: row.createdAt.toISOString()
    }));
  }
  async unlink(linkId) {
    const result = this.database.delete(taskResourcesTable).where(eq10(taskResourcesTable.id, linkId)).run();
    return result.changes > 0;
  }
};

// src/shared/contracts/desktop-api.ts
import { z } from "zod";
var agentProviderIdSchema = z.enum(["mcp"]);
var taskStatusSchema = z.enum([
  "new",
  "planning",
  "requires_clarification",
  "implementation",
  "testing",
  "completed"
]);
var planSourceSchema = z.enum(["human", "agent"]);
var planDiscussionAuthorSchema = z.enum(["human", "agent"]);
var agentSessionStatusSchema = z.enum(["idle", "running", "completed", "failed"]);
var projectRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  rootPath: z.string().nullable(),
  languages: z.array(z.string()),
  skillFilePath: z.string().nullable(),
  skillPrompt: z.string(),
  isProfileComplete: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});
var taskRecordSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  title: z.string(),
  description: z.string(),
  status: taskStatusSchema,
  planContentMd: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});
var planRecordSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  contentMd: z.string(),
  source: planSourceSchema,
  createdAt: z.string(),
  updatedAt: z.string()
});
var planRevisionRecordSchema = z.object({
  id: z.string(),
  planId: z.string(),
  taskId: z.string(),
  contentMd: z.string(),
  source: planSourceSchema,
  createdAt: z.string()
});
var agentSessionRecordSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  provider: agentProviderIdSchema,
  externalSessionId: z.string().nullable(),
  externalThreadId: z.string().nullable(),
  status: agentSessionStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string()
});
var resourceRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  contentMd: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});
var planCommentKindSchema = z.enum(["discussion", "extension", "improvement"]);
var planCommentRecordSchema = z.object({
  id: z.string(),
  planId: z.string(),
  taskId: z.string(),
  kind: planCommentKindSchema,
  author: planDiscussionAuthorSchema,
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});
var planQuestionRecordSchema = z.object({
  id: z.string(),
  planId: z.string(),
  taskId: z.string(),
  content: z.string(),
  answer: z.string().nullable(),
  answeredAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});
var taskContextItemSchema = z.string().trim().min(1).max(4e3);
var taskContextListSchema = z.array(taskContextItemSchema).max(200);
var taskContextRecordSchema = z.object({
  goal: taskContextListSchema,
  criticalConditions: taskContextListSchema,
  forbiddenInterpretations: taskContextListSchema,
  acceptanceCriteria: taskContextListSchema
});
var linkedResourceRecordSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  name: z.string(),
  contentMd: z.string(),
  comment: z.string(),
  createdAt: z.string()
});
var linkedTaskRecordSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  title: z.string(),
  status: taskStatusSchema,
  projectName: z.string(),
  comment: z.string(),
  direction: z.enum(["outgoing", "incoming"]),
  createdAt: z.string()
});
var taskDetailSchema = z.object({
  project: projectRecordSchema,
  task: taskRecordSchema,
  plan: planRecordSchema.nullable(),
  planRevisions: z.array(planRevisionRecordSchema),
  planComments: z.array(planCommentRecordSchema),
  planQuestions: z.array(planQuestionRecordSchema),
  taskContext: taskContextRecordSchema,
  agentSession: agentSessionRecordSchema.nullable(),
  linkedTasks: z.array(linkedTaskRecordSchema),
  linkedResources: z.array(linkedResourceRecordSchema)
});
var appHealthSnapshotSchema = z.object({
  appName: z.string(),
  databasePath: z.string(),
  platform: z.string(),
  agentProviders: z.array(agentProviderIdSchema),
  mcpEndpoint: z.string().nullable(),
  mcpServerRunning: z.boolean()
});
var createTaskInputSchema = z.object({
  title: z.string().trim().min(3, "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043C\u0438\u043D\u0438\u043C\u0443\u043C 3 \u0441\u0438\u043C\u0432\u043E\u043B\u0430 \u0432 \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043A\u0435.").max(120),
  description: z.string().trim().min(12, "\u041E\u043F\u0438\u0448\u0438\u0442\u0435 \u0437\u0430\u0434\u0430\u0447\u0443 \u0445\u043E\u0442\u044F \u0431\u044B \u0432 12 \u0441\u0438\u043C\u0432\u043E\u043B\u0430\u0445."),
  projectId: z.string().trim().min(1).optional(),
  projectName: z.string().trim().min(2, "\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043F\u0440\u043E\u0435\u043A\u0442 \u043C\u0438\u043D\u0438\u043C\u0443\u043C \u0438\u0437 2 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432.").max(80).optional()
}).superRefine((value, context) => {
  if (value.projectId || value.projectName) {
    return;
  }
  context.addIssue({
    code: "custom",
    path: ["projectName"],
    message: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u0438\u043B\u0438 \u0443\u043A\u0430\u0436\u0438\u0442\u0435 \u043D\u043E\u0432\u044B\u0439."
  });
});
var createProjectInputSchema = z.object({
  name: z.string().trim().min(2, "\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u043C\u0438\u043D\u0438\u043C\u0443\u043C \u0438\u0437 2 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432.").max(80)
});
var updateProjectProfileInputSchema = z.object({
  projectId: z.string(),
  name: z.string().trim().min(2, "\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u043C\u0438\u043D\u0438\u043C\u0443\u043C \u0438\u0437 2 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432.").max(80).optional(),
  description: z.string().trim().max(4e3).optional(),
  rootPath: z.string().trim().min(1, "\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043F\u0443\u0442\u044C \u043A \u043F\u0440\u043E\u0435\u043A\u0442\u0443.").max(500).nullable().optional(),
  languages: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  skillFilePath: z.string().trim().min(1, "\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043F\u0443\u0442\u044C \u043A skill-\u0444\u0430\u0439\u043B\u0443.").max(500).nullable().optional(),
  skillPrompt: z.string().trim().max(4e3).optional()
}).superRefine((value, context) => {
  const hasChanges = value.name !== void 0 || value.description !== void 0 || value.rootPath !== void 0 || value.languages !== void 0 || value.skillFilePath !== void 0 || value.skillPrompt !== void 0;
  if (hasChanges) {
    return;
  }
  context.addIssue({
    code: "custom",
    path: ["projectId"],
    message: "\u041F\u0435\u0440\u0435\u0434\u0430\u0439\u0442\u0435 \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u043D\u043E \u043F\u043E\u043B\u0435 \u0434\u043B\u044F \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u043F\u0440\u043E\u0435\u043A\u0442\u0430."
  });
});
var savePlanInputSchema = z.object({
  taskId: z.string(),
  contentMd: z.string().trim().min(1, "\u041F\u043B\u0430\u043D \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043F\u0443\u0441\u0442\u044B\u043C."),
  openQuestions: z.array(z.string().trim().min(1).max(4e3)).max(50).optional(),
  goal: taskContextListSchema.optional(),
  criticalConditions: taskContextListSchema.optional(),
  forbiddenInterpretations: taskContextListSchema.optional(),
  acceptanceCriteria: taskContextListSchema.optional(),
  source: planSourceSchema.default("human")
});
var appendPlanExtensionInputSchema = z.object({
  taskId: z.string(),
  content: z.string().trim().min(1),
  author: planDiscussionAuthorSchema.default("human")
});
var appendPlanImprovementInputSchema = z.object({
  taskId: z.string(),
  content: z.string().trim().min(1),
  author: planDiscussionAuthorSchema.default("human")
});
var consolidatePlanDiscussionInputSchema = z.object({
  taskId: z.string(),
  contentMd: z.string().trim().min(1, "\u041F\u043B\u0430\u043D \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043F\u0443\u0441\u0442\u044B\u043C."),
  openQuestions: z.array(z.string().trim().min(1).max(4e3)).max(50).optional(),
  source: planSourceSchema.default("agent")
});
var answerPlanQuestionInputSchema = z.object({
  taskId: z.string(),
  questionId: z.string(),
  answer: z.string().trim().min(1).max(4e3)
});
var addPlanQuestionInputSchema = z.object({
  taskId: z.string(),
  content: z.string().trim().min(1).max(4e3)
});
var createResourceInputSchema = z.object({
  name: z.string().trim().min(1, "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0440\u0435\u0441\u0443\u0440\u0441\u0430.").max(200),
  contentMd: z.string().optional()
});
var updateResourceInputSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0440\u0435\u0441\u0443\u0440\u0441\u0430.").max(200).optional(),
  contentMd: z.string().optional()
}).refine((v) => v.name !== void 0 || v.contentMd !== void 0, {
  message: "\u041F\u0435\u0440\u0435\u0434\u0430\u0439\u0442\u0435 \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u043D\u043E \u043F\u043E\u043B\u0435 \u0434\u043B\u044F \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u0440\u0435\u0441\u0443\u0440\u0441\u0430."
});
var linkResourceInputSchema = z.object({
  taskId: z.string(),
  resourceId: z.string(),
  comment: z.string().max(500).default("")
});
var unlinkResourceInputSchema = z.object({
  linkId: z.string(),
  taskId: z.string()
});
var deleteTaskResultSchema = z.object({
  deletedTaskId: z.string()
});
var updateTaskStatusInputSchema = z.object({
  taskId: z.string(),
  status: taskStatusSchema
});
var updateTaskInputSchema = z.object({
  taskId: z.string(),
  title: z.string().trim().min(3, "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043C\u0438\u043D\u0438\u043C\u0443\u043C 3 \u0441\u0438\u043C\u0432\u043E\u043B\u0430.").max(120).optional(),
  description: z.string().trim().min(12, "\u041E\u043F\u0438\u0448\u0438\u0442\u0435 \u0437\u0430\u0434\u0430\u0447\u0443 \u0445\u043E\u0442\u044F \u0431\u044B \u0432 12 \u0441\u0438\u043C\u0432\u043E\u043B\u0430\u0445.").optional()
}).refine(
  (v) => v.title !== void 0 || v.description !== void 0,
  { message: "\u041F\u0435\u0440\u0435\u0434\u0430\u0439\u0442\u0435 \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u043D\u043E \u043F\u043E\u043B\u0435 \u0434\u043B\u044F \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u0437\u0430\u0434\u0430\u0447\u0438." }
);
var restorePlanRevisionInputSchema = z.object({
  revisionId: z.string(),
  taskId: z.string()
});
var linkTaskInputSchema = z.object({
  sourceTaskId: z.string(),
  targetTaskId: z.string(),
  comment: z.string().max(500).default("")
}).refine(
  (v) => v.sourceTaskId !== v.targetTaskId,
  { message: "\u041D\u0435\u043B\u044C\u0437\u044F \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0443 \u043A \u0441\u0430\u043C\u043E\u0439 \u0441\u0435\u0431\u0435." }
);
var unlinkTaskInputSchema = z.object({
  linkId: z.string(),
  taskId: z.string()
});
var promptOverrideRecordSchema = z.object({
  id: z.string(),
  template: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});
var upsertPromptOverrideInputSchema = z.object({
  id: z.string().min(1),
  template: z.string().min(1, "\u0428\u0430\u0431\u043B\u043E\u043D \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043F\u0443\u0441\u0442\u044B\u043C.").max(8e3)
});
var deletePromptOverrideInputSchema = z.object({
  id: z.string().min(1)
});
var desktopDataChangeEventSchema = z.object({
  projectId: z.string().nullable(),
  reason: z.enum([
    "add-plan-comment",
    "add-plan-question",
    "answer-plan-question",
    "append-plan-extension",
    "append-plan-improvement",
    "consolidate-plan-discussion",
    "create-project",
    "create-resource",
    "create-task",
    "delete-resource",
    "delete-task",
    "link-resource",
    "link-task",
    "restore-plan-revision",
    "save-plan",
    "unlink-resource",
    "unlink-task",
    "update-project-profile",
    "update-resource",
    "update-task",
    "update-task-status"
  ]),
  taskId: z.string().nullable()
});

// src/shared/plans/managed-plan-content.ts
var EXTENSIONS_MARKER_START = "aitasker:plan-extensions:start";
var EXTENSIONS_MARKER_END = "aitasker:plan-extensions:end";
var IMPROVEMENTS_MARKER_START = "aitasker:plan-improvements:start";
var IMPROVEMENTS_MARKER_END = "aitasker:plan-improvements:end";
var DISCUSSION_MARKER_START = "aitasker:plan-discussion:start";
var DISCUSSION_MARKER_END = "aitasker:plan-discussion:end";
var QUESTIONS_MARKER_START = "aitasker:plan-questions:start";
var QUESTIONS_MARKER_END = "aitasker:plan-questions:end";
var LEGACY_EXTENSIONS_MARKER_START = "<!-- aitasker:plan-extensions:start -->";
var LEGACY_EXTENSIONS_MARKER_END = "<!-- aitasker:plan-extensions:end -->";
var LEGACY_IMPROVEMENTS_MARKER_START = "<!-- aitasker:plan-improvements:start -->";
var LEGACY_IMPROVEMENTS_MARKER_END = "<!-- aitasker:plan-improvements:end -->";
var EXTENSIONS_TITLE = "\u0420\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u044F \u043F\u043B\u0430\u043D\u0430";
var IMPROVEMENTS_TITLE = "\u0414\u043E\u0440\u0430\u0431\u043E\u0442\u043A\u0438";
var DISCUSSION_TITLE = "\u041E\u0431\u0441\u0443\u0436\u0434\u0435\u043D\u0438\u0435";
var QUESTIONS_TITLE = "\u041E\u0442\u043A\u0440\u044B\u0442\u044B\u0435 \u0432\u043E\u043F\u0440\u043E\u0441\u044B";
var LEGACY_NOTES_TITLE = "\u0417\u0430\u043C\u0435\u0442\u043A\u0438";
var hiddenSectionConfigByKind = {
  discussion: {
    endMarker: DISCUSSION_MARKER_END,
    startMarker: DISCUSSION_MARKER_START,
    title: DISCUSSION_TITLE
  },
  extension: {
    endMarker: EXTENSIONS_MARKER_END,
    startMarker: EXTENSIONS_MARKER_START,
    title: EXTENSIONS_TITLE
  },
  improvement: {
    endMarker: IMPROVEMENTS_MARKER_END,
    startMarker: IMPROVEMENTS_MARKER_START,
    title: IMPROVEMENTS_TITLE
  }
};
var legacyVisibleSectionConfigByKind = {
  extension: {
    endMarker: LEGACY_EXTENSIONS_MARKER_END,
    startMarker: LEGACY_EXTENSIONS_MARKER_START,
    title: EXTENSIONS_TITLE
  },
  improvement: {
    endMarker: LEGACY_IMPROVEMENTS_MARKER_END,
    startMarker: LEGACY_IMPROVEMENTS_MARKER_START,
    title: IMPROVEMENTS_TITLE
  }
};
function normalizeMarkdown(text2) {
  return text2.replace(/\r\n?/g, "\n").trim();
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function createManagedEntityId(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
function formatManagedPlanComment(comment) {
  return {
    author: comment.author === "agent" ? "agent" : "human",
    content: normalizeMarkdown(comment.content ?? ""),
    createdAt: comment.createdAt?.trim() || null,
    id: comment.id?.trim() || createManagedEntityId("comment")
  };
}
function formatManagedPlanQuestion(question) {
  return {
    content: normalizeMarkdown(question.content ?? ""),
    createdAt: question.createdAt?.trim() || null,
    id: question.id?.trim() || createManagedEntityId("question")
  };
}
function parseLegacyItems(body) {
  const normalizedBody = normalizeMarkdown(body);
  if (!normalizedBody) {
    return [];
  }
  const lines = normalizedBody.split("\n");
  const items = [];
  let current = [];
  for (const line of lines) {
    if (line.startsWith("- ")) {
      if (current.length > 0) {
        items.push(current.join("\n").trim());
      }
      current = [line.slice(2)];
      continue;
    }
    if (current.length === 0) {
      current = [line];
      continue;
    }
    current.push(line.startsWith("  ") ? line.slice(2) : line);
  }
  if (current.length > 0) {
    items.push(current.join("\n").trim());
  }
  return items.filter(Boolean).map(
    (content) => formatManagedPlanComment({
      author: "human",
      content,
      createdAt: null
    })
  );
}
function extractHiddenCommentSection(contentMd, config) {
  const pattern = new RegExp(
    `<!-- ${escapeRegExp(config.startMarker)}\\s*\\n([\\s\\S]*?)\\n${escapeRegExp(config.endMarker)} -->`,
    "m"
  );
  const match = contentMd.match(pattern);
  if (!match) {
    return {
      comments: [],
      contentMd
    };
  }
  try {
    const parsed = JSON.parse(match[1] ?? "[]");
    const comments = Array.isArray(parsed) ? parsed.map((comment) => formatManagedPlanComment(comment)).filter((comment) => Boolean(comment.content)) : [];
    return {
      comments,
      contentMd: normalizeMarkdown(contentMd.replace(match[0], ""))
    };
  } catch {
    return {
      comments: [],
      contentMd: normalizeMarkdown(contentMd.replace(match[0], ""))
    };
  }
}
function extractHiddenQuestionSection(contentMd) {
  const pattern = new RegExp(
    `<!-- ${escapeRegExp(QUESTIONS_MARKER_START)}\\s*\\n([\\s\\S]*?)\\n${escapeRegExp(QUESTIONS_MARKER_END)} -->`,
    "m"
  );
  const match = contentMd.match(pattern);
  if (!match) {
    return {
      contentMd,
      questions: []
    };
  }
  try {
    const parsed = JSON.parse(match[1] ?? "[]");
    const questions = Array.isArray(parsed) ? parsed.map((question) => formatManagedPlanQuestion(question)).filter((question) => Boolean(question.content)) : [];
    return {
      contentMd: normalizeMarkdown(contentMd.replace(match[0], "")),
      questions
    };
  } catch {
    return {
      contentMd: normalizeMarkdown(contentMd.replace(match[0], "")),
      questions: []
    };
  }
}
function extractLegacyVisibleSection(contentMd, config) {
  const pattern = new RegExp(
    `${escapeRegExp(config.startMarker)}\\s*\\n## ${escapeRegExp(config.title)}\\s*\\n([\\s\\S]*?)\\n${escapeRegExp(config.endMarker)}`,
    "m"
  );
  const match = contentMd.match(pattern);
  if (!match) {
    return {
      comments: [],
      contentMd
    };
  }
  return {
    comments: parseLegacyItems(match[1] ?? ""),
    contentMd: normalizeMarkdown(contentMd.replace(match[0], ""))
  };
}
function extractLegacyNotesSection(contentMd) {
  const pattern = new RegExp(`(?:^|\\n)## ${escapeRegExp(LEGACY_NOTES_TITLE)}\\s*\\n([\\s\\S]*)$`, "m");
  const match = contentMd.match(pattern);
  if (!match) {
    return {
      comments: [],
      contentMd
    };
  }
  return {
    comments: parseLegacyItems(match[1] ?? ""),
    contentMd: normalizeMarkdown(contentMd.slice(0, match.index).trim())
  };
}
function formatCommentTimestamp(createdAt) {
  if (!createdAt) {
    return "\u0431\u0435\u0437 \u0432\u0440\u0435\u043C\u0435\u043D\u0438";
  }
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return "\u0431\u0435\u0437 \u0432\u0440\u0435\u043C\u0435\u043D\u0438";
  }
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  });
}
function getAuthorLabel(author) {
  return author === "agent" ? "AI \u0430\u0433\u0435\u043D\u0442" : "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C";
}
function formatRenderedCommentSection(title, comments) {
  if (comments.length === 0) {
    return "";
  }
  return [
    `## ${title}`,
    comments.map(
      (comment) => [`### ${getAuthorLabel(comment.author)} \xB7 ${formatCommentTimestamp(comment.createdAt)}`, comment.content].join(
        "\n\n"
      )
    ).join("\n\n")
  ].join("\n\n");
}
function formatRenderedQuestionSection(questions) {
  if (questions.length === 0) {
    return "";
  }
  return [
    `## ${QUESTIONS_TITLE}`,
    questions.map((question) => `- ${question.content}`).join("\n")
  ].join("\n\n");
}
function stripRenderedDiscussionSections(contentMd) {
  const normalizedContent = normalizeMarkdown(contentMd);
  const sectionsPattern = new RegExp(
    `(?:\\n|^)## ${escapeRegExp(EXTENSIONS_TITLE)}\\s*\\n[\\s\\S]*$|(?:\\n|^)## ${escapeRegExp(IMPROVEMENTS_TITLE)}\\s*\\n[\\s\\S]*$|(?:\\n|^)## ${escapeRegExp(DISCUSSION_TITLE)}\\s*\\n[\\s\\S]*$|(?:\\n|^)## ${escapeRegExp(QUESTIONS_TITLE)}\\s*\\n[\\s\\S]*$`,
    "m"
  );
  return normalizeMarkdown(normalizedContent.replace(sectionsPattern, ""));
}
function parseManagedPlanContent(contentMd) {
  const normalizedContent = normalizeMarkdown(contentMd);
  const extractedExtensionsHidden = extractHiddenCommentSection(normalizedContent, hiddenSectionConfigByKind.extension);
  const extractedImprovementsHidden = extractHiddenCommentSection(
    extractedExtensionsHidden.contentMd,
    hiddenSectionConfigByKind.improvement
  );
  const extractedDiscussionHidden = extractHiddenCommentSection(
    extractedImprovementsHidden.contentMd,
    hiddenSectionConfigByKind.discussion
  );
  const extractedQuestionsHidden = extractHiddenQuestionSection(extractedDiscussionHidden.contentMd);
  const extractedExtensionsVisible = extractedExtensionsHidden.comments.length ? { comments: [], contentMd: extractedQuestionsHidden.contentMd } : extractLegacyVisibleSection(extractedQuestionsHidden.contentMd, legacyVisibleSectionConfigByKind.extension);
  const extractedImprovementsVisible = extractedImprovementsHidden.comments.length ? { comments: [], contentMd: extractedExtensionsVisible.contentMd } : extractLegacyVisibleSection(extractedExtensionsVisible.contentMd, legacyVisibleSectionConfigByKind.improvement);
  const legacyNotes = extractedExtensionsHidden.comments.length || extractedExtensionsVisible.comments.length ? { comments: [], contentMd: extractedImprovementsVisible.contentMd } : extractLegacyNotesSection(extractedImprovementsVisible.contentMd);
  const baseContentMd = normalizeMarkdown(legacyNotes.contentMd);
  const extensions = [
    ...extractedExtensionsHidden.comments,
    ...extractedExtensionsVisible.comments,
    ...legacyNotes.comments
  ];
  const improvements = [...extractedImprovementsHidden.comments, ...extractedImprovementsVisible.comments];
  const discussion = extractedDiscussionHidden.comments;
  const questions = extractedQuestionsHidden.questions;
  return {
    baseContentMd,
    discussion,
    extensions,
    improvements,
    questions,
    renderedContentMd: [
      baseContentMd,
      formatRenderedCommentSection(EXTENSIONS_TITLE, extensions),
      formatRenderedCommentSection(IMPROVEMENTS_TITLE, improvements),
      formatRenderedCommentSection(DISCUSSION_TITLE, discussion),
      formatRenderedQuestionSection(questions)
    ].filter(Boolean).join("\n\n").trim()
  };
}
function extractBasePlanContent(contentMd) {
  const parsed = parseManagedPlanContent(contentMd);
  return stripRenderedDiscussionSections(parsed.baseContentMd);
}

// src/main/services/app-service.ts
function createAppService(dependencies) {
  const emitDataChanged = (event) => {
    dependencies.onDataChanged?.(event);
  };
  const hasTaskContextPatch = (input) => {
    return input.goal !== void 0 || input.criticalConditions !== void 0 || input.forbiddenInterpretations !== void 0 || input.acceptanceCriteria !== void 0;
  };
  const mergeTaskContext = (current, input) => {
    return {
      goal: input.goal ?? current.goal,
      criticalConditions: input.criticalConditions ?? current.criticalConditions,
      forbiddenInterpretations: input.forbiddenInterpretations ?? current.forbiddenInterpretations,
      acceptanceCriteria: input.acceptanceCriteria ?? current.acceptanceCriteria
    };
  };
  const getTaskDetail = async (taskId, projectId) => {
    const task = await dependencies.taskRepository.getById(taskId, projectId);
    if (!task) {
      throw new Error(`Task ${taskId} was not found.`);
    }
    const project = await dependencies.projectRepository.getById(task.projectId);
    if (!project) {
      throw new Error(`Project ${task.projectId} was not found.`);
    }
    const [plan, planRevisions, planComments, planQuestions, taskContext, agentSession, linkedTasks, linkedResources] = await Promise.all([
      dependencies.planRepository.getByTaskId(taskId),
      dependencies.planRepository.listRevisions(taskId),
      dependencies.planCommentRepository.listCommentsByTaskId(taskId),
      dependencies.planCommentRepository.listQuestionsByTaskId(taskId),
      dependencies.taskContextRepository.getByTaskId(taskId),
      dependencies.agentSessionRepository.getByTaskId(taskId),
      dependencies.taskLinkRepository.listByTaskId(taskId),
      dependencies.taskResourceRepository.listByTaskId(taskId)
    ]);
    return {
      project,
      task,
      plan,
      planRevisions,
      planComments,
      planQuestions,
      taskContext,
      agentSession,
      linkedTasks,
      linkedResources
    };
  };
  const resolveProjectForTask = async (input) => {
    if (input.projectId) {
      const project = await dependencies.projectRepository.getById(input.projectId);
      if (!project) {
        throw new Error(`Project ${input.projectId} was not found.`);
      }
      return project;
    }
    if (input.projectName) {
      return dependencies.projectRepository.create({ name: input.projectName });
    }
    throw new Error("Project id or project name is required.");
  };
  return {
    async addPlanQuestion(input) {
      const parsedInput = addPlanQuestionInputSchema.parse(input);
      const detail = await getTaskDetail(parsedInput.taskId);
      if (!detail.plan) {
        throw new Error("\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0441\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u0438\u043B\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0431\u0430\u0437\u043E\u0432\u044B\u0439 \u043F\u043B\u0430\u043D, \u0437\u0430\u0442\u0435\u043C \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0439\u0442\u0435 \u0432\u043E\u043F\u0440\u043E\u0441\u044B.");
      }
      const question = await dependencies.planCommentRepository.addQuestion({
        planId: detail.plan.id,
        taskId: parsedInput.taskId,
        content: parsedInput.content
      });
      emitDataChanged({
        reason: "add-plan-question",
        projectId: detail.task.projectId,
        taskId: parsedInput.taskId
      });
      return question;
    },
    async answerPlanQuestion(input) {
      const parsedInput = answerPlanQuestionInputSchema.parse(input);
      const question = await dependencies.planCommentRepository.getQuestionById(parsedInput.questionId);
      if (!question || question.taskId !== parsedInput.taskId) {
        throw new Error(`\u0412\u043E\u043F\u0440\u043E\u0441 ${parsedInput.questionId} \u0434\u043B\u044F \u0437\u0430\u0434\u0430\u0447\u0438 ${parsedInput.taskId} \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D.`);
      }
      const answered = await dependencies.planCommentRepository.answerQuestion(
        parsedInput.questionId,
        parsedInput.answer
      );
      const detail = await getTaskDetail(parsedInput.taskId);
      emitDataChanged({
        reason: "answer-plan-question",
        projectId: detail.task.projectId,
        taskId: parsedInput.taskId
      });
      return answered;
    },
    async appendPlanExtension(input) {
      const parsedInput = appendPlanExtensionInputSchema.parse(input);
      const detail = await getTaskDetail(parsedInput.taskId);
      if (!detail.plan) {
        throw new Error("\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0441\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u0438\u043B\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0431\u0430\u0437\u043E\u0432\u044B\u0439 \u043F\u043B\u0430\u043D, \u0437\u0430\u0442\u0435\u043C \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0439\u0442\u0435 \u0435\u0433\u043E \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u044F.");
      }
      const comment = await dependencies.planCommentRepository.addComment({
        planId: detail.plan.id,
        taskId: parsedInput.taskId,
        kind: "extension",
        author: parsedInput.author ?? "human",
        content: parsedInput.content
      });
      emitDataChanged({
        reason: "add-plan-comment",
        projectId: detail.task.projectId,
        taskId: parsedInput.taskId
      });
      return comment;
    },
    async appendPlanImprovement(input) {
      const parsedInput = appendPlanImprovementInputSchema.parse(input);
      const detail = await getTaskDetail(parsedInput.taskId);
      if (!detail.plan) {
        throw new Error("\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0441\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u0438\u043B\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0431\u0430\u0437\u043E\u0432\u044B\u0439 \u043F\u043B\u0430\u043D, \u0437\u0430\u0442\u0435\u043C \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0439\u0442\u0435 \u0435\u0433\u043E \u0434\u043E\u0440\u0430\u0431\u043E\u0442\u043A\u0438.");
      }
      const comment = await dependencies.planCommentRepository.addComment({
        planId: detail.plan.id,
        taskId: parsedInput.taskId,
        kind: "improvement",
        author: parsedInput.author ?? "human",
        content: parsedInput.content
      });
      emitDataChanged({
        reason: "add-plan-comment",
        projectId: detail.task.projectId,
        taskId: parsedInput.taskId
      });
      return comment;
    },
    async consolidatePlanDiscussion(input) {
      const parsedInput = consolidatePlanDiscussionInputSchema.parse(input);
      const detail = await getTaskDetail(parsedInput.taskId);
      const nextBaseContentMd = extractBasePlanContent(parsedInput.contentMd);
      const savedPlan = await dependencies.planRepository.save({
        taskId: parsedInput.taskId,
        contentMd: nextBaseContentMd,
        createRevision: parsedInput.source === "agent",
        source: parsedInput.source
      });
      await dependencies.planCommentRepository.deleteCommentsByPlanId(savedPlan.id);
      await dependencies.planCommentRepository.deleteOpenQuestionsByPlanId(savedPlan.id);
      if (parsedInput.openQuestions?.length) {
        for (const content of parsedInput.openQuestions) {
          await dependencies.planCommentRepository.addQuestion({
            planId: savedPlan.id,
            taskId: parsedInput.taskId,
            content
          });
        }
      }
      await dependencies.projectRepository.touch(detail.task.projectId);
      if (parsedInput.source === "agent") {
        await dependencies.agentSessionRepository.upsert({
          provider: "mcp",
          status: "completed",
          taskId: parsedInput.taskId,
          externalSessionId: null,
          externalThreadId: null
        });
      }
      emitDataChanged({
        reason: "consolidate-plan-discussion",
        projectId: detail.task.projectId,
        taskId: parsedInput.taskId
      });
      return getTaskDetail(parsedInput.taskId);
    },
    async createProject(input) {
      const parsedInput = createProjectInputSchema.parse(input);
      const project = await dependencies.projectRepository.create(parsedInput);
      emitDataChanged({
        reason: "create-project",
        projectId: project.id,
        taskId: null
      });
      return project;
    },
    async createTask(input) {
      const parsedInput = createTaskInputSchema.parse(input);
      const project = await resolveProjectForTask(parsedInput);
      const task = await dependencies.taskRepository.create({
        description: parsedInput.description,
        projectId: project.id,
        title: parsedInput.title
      });
      await dependencies.projectRepository.touch(project.id);
      emitDataChanged({
        reason: "create-task",
        projectId: project.id,
        taskId: task.id
      });
      return getTaskDetail(task.id);
    },
    async deleteTask(taskId) {
      const existingTask = await dependencies.taskRepository.getById(taskId);
      if (!existingTask) {
        throw new Error(`Task ${taskId} was not found.`);
      }
      const deleted = await dependencies.taskRepository.delete(taskId);
      if (!deleted) {
        throw new Error(`Task ${taskId} could not be deleted.`);
      }
      emitDataChanged({
        reason: "delete-task",
        projectId: existingTask.projectId,
        taskId
      });
      return {
        deletedTaskId: taskId
      };
    },
    async exportData() {
      const { dialog } = await import("electron");
      const result = await dialog.showSaveDialog({
        title: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0434\u0430\u043D\u043D\u044B\u0435 AITasker",
        defaultPath: "aitasker-backup.sqlite",
        filters: [{ name: "SQLite Database", extensions: ["sqlite"] }]
      });
      if (result.canceled || !result.filePath) {
        return null;
      }
      await dependencies.sqlite.backup(result.filePath);
      return { filePath: result.filePath };
    },
    getHealthSnapshot() {
      return {
        appName: "AITasker",
        databasePath: dependencies.databasePath,
        platform: dependencies.platform,
        agentProviders: [...dependencies.agentProviders],
        mcpEndpoint: dependencies.getMcpEndpoint(),
        mcpServerRunning: dependencies.isMcpRunning()
      };
    },
    async importData() {
      const { dialog } = await import("electron");
      const result = await dialog.showOpenDialog({
        title: "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0434\u0430\u043D\u043D\u044B\u0435 AITasker",
        filters: [{ name: "SQLite Database", extensions: ["sqlite"] }],
        properties: ["openFile"]
      });
      if (result.canceled || result.filePaths.length === 0) {
        return;
      }
      const sourcePath = result.filePaths[0];
      const { copyFileSync } = await import("fs");
      dependencies.sqlite.pragma("wal_checkpoint(TRUNCATE)");
      copyFileSync(sourcePath, dependencies.databasePath);
      dependencies.relaunchApp();
    },
    getProject(projectId) {
      return dependencies.projectRepository.getById(projectId);
    },
    getTaskDetail,
    listProjects() {
      return dependencies.projectRepository.list();
    },
    listTasks(projectId) {
      return dependencies.taskRepository.list(projectId);
    },
    async restorePlanRevision(input) {
      const parsedInput = restorePlanRevisionInputSchema.parse(input);
      const detail = await getTaskDetail(parsedInput.taskId);
      await dependencies.planRepository.restoreRevision(parsedInput);
      await dependencies.taskRepository.touch(parsedInput.taskId);
      await dependencies.projectRepository.touch(detail.task.projectId);
      emitDataChanged({
        reason: "restore-plan-revision",
        projectId: detail.task.projectId,
        taskId: parsedInput.taskId
      });
      return getTaskDetail(parsedInput.taskId);
    },
    async savePlan(input) {
      const parsedInput = savePlanInputSchema.parse(input);
      const detail = await getTaskDetail(parsedInput.taskId);
      const nextBaseContentMd = extractBasePlanContent(parsedInput.contentMd);
      const savedPlan = await dependencies.planRepository.save({
        taskId: parsedInput.taskId,
        contentMd: nextBaseContentMd,
        createRevision: parsedInput.source === "agent",
        source: parsedInput.source
      });
      if (parsedInput.openQuestions !== void 0) {
        await dependencies.planCommentRepository.deleteOpenQuestionsByPlanId(savedPlan.id);
        for (const content of parsedInput.openQuestions) {
          await dependencies.planCommentRepository.addQuestion({
            planId: savedPlan.id,
            taskId: parsedInput.taskId,
            content
          });
        }
      }
      if (hasTaskContextPatch(parsedInput)) {
        const nextTaskContext = mergeTaskContext(detail.taskContext, parsedInput);
        await dependencies.taskContextRepository.replaceByTaskId(parsedInput.taskId, nextTaskContext);
      }
      await dependencies.projectRepository.touch(detail.task.projectId);
      if (parsedInput.source === "agent") {
        await dependencies.agentSessionRepository.upsert({
          provider: "mcp",
          status: "completed",
          taskId: parsedInput.taskId,
          externalSessionId: null,
          externalThreadId: null
        });
      }
      emitDataChanged({
        reason: "save-plan",
        projectId: detail.task.projectId,
        taskId: parsedInput.taskId
      });
      return getTaskDetail(parsedInput.taskId);
    },
    async updateTask(input) {
      const parsedInput = updateTaskInputSchema.parse(input);
      const detail = await getTaskDetail(parsedInput.taskId);
      await dependencies.taskRepository.update(parsedInput.taskId, {
        title: parsedInput.title,
        description: parsedInput.description
      });
      await dependencies.projectRepository.touch(detail.task.projectId);
      emitDataChanged({
        reason: "update-task",
        projectId: detail.task.projectId,
        taskId: parsedInput.taskId
      });
      return getTaskDetail(parsedInput.taskId);
    },
    async updateTaskStatus(input) {
      const parsedInput = updateTaskStatusInputSchema.parse(input);
      const detail = await getTaskDetail(parsedInput.taskId);
      await dependencies.taskRepository.updateStatus(parsedInput.taskId, parsedInput.status);
      await dependencies.projectRepository.touch(detail.task.projectId);
      emitDataChanged({
        reason: "update-task-status",
        projectId: detail.task.projectId,
        taskId: parsedInput.taskId
      });
      return getTaskDetail(parsedInput.taskId);
    },
    async updateProjectProfile(input) {
      const parsedInput = updateProjectProfileInputSchema.parse(input);
      const project = await dependencies.projectRepository.updateProfile(parsedInput);
      emitDataChanged({
        reason: "update-project-profile",
        projectId: project.id,
        taskId: null
      });
      return project;
    },
    async linkTask(input) {
      const parsedInput = linkTaskInputSchema.parse(input);
      const detail = await getTaskDetail(parsedInput.sourceTaskId);
      await dependencies.taskLinkRepository.create({
        sourceTaskId: parsedInput.sourceTaskId,
        targetTaskId: parsedInput.targetTaskId,
        comment: parsedInput.comment
      });
      await dependencies.taskRepository.touch(parsedInput.sourceTaskId);
      await dependencies.projectRepository.touch(detail.task.projectId);
      emitDataChanged({
        reason: "link-task",
        projectId: detail.task.projectId,
        taskId: parsedInput.sourceTaskId
      });
      return getTaskDetail(parsedInput.sourceTaskId);
    },
    async unlinkTask(input) {
      const parsedInput = unlinkTaskInputSchema.parse(input);
      const detail = await getTaskDetail(parsedInput.taskId);
      const deleted = await dependencies.taskLinkRepository.delete(parsedInput.linkId);
      if (!deleted) {
        throw new Error(`\u0421\u0432\u044F\u0437\u044C ${parsedInput.linkId} \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430.`);
      }
      await dependencies.taskRepository.touch(parsedInput.taskId);
      await dependencies.projectRepository.touch(detail.task.projectId);
      emitDataChanged({
        reason: "unlink-task",
        projectId: detail.task.projectId,
        taskId: parsedInput.taskId
      });
      return getTaskDetail(parsedInput.taskId);
    },
    async createResource(input) {
      const parsedInput = createResourceInputSchema.parse(input);
      const resource = await dependencies.resourceRepository.create(parsedInput);
      emitDataChanged({ reason: "create-resource", projectId: null, taskId: null });
      return resource;
    },
    async getResource(id) {
      const resource = await dependencies.resourceRepository.getById(id);
      if (!resource) {
        throw new Error(`Resource ${id} was not found.`);
      }
      return resource;
    },
    listResources() {
      return dependencies.resourceRepository.list();
    },
    async updateResource(input) {
      const parsedInput = updateResourceInputSchema.parse(input);
      const resource = await dependencies.resourceRepository.update(parsedInput.id, {
        name: parsedInput.name,
        contentMd: parsedInput.contentMd
      });
      emitDataChanged({ reason: "update-resource", projectId: null, taskId: null });
      return resource;
    },
    async deleteResource(id) {
      await dependencies.resourceRepository.delete(id);
      emitDataChanged({ reason: "delete-resource", projectId: null, taskId: null });
    },
    async linkResource(input) {
      const parsedInput = linkResourceInputSchema.parse(input);
      await dependencies.taskResourceRepository.link({
        taskId: parsedInput.taskId,
        resourceId: parsedInput.resourceId,
        comment: parsedInput.comment
      });
      const detail = await getTaskDetail(parsedInput.taskId);
      emitDataChanged({ reason: "link-resource", projectId: detail.task.projectId, taskId: parsedInput.taskId });
      return getTaskDetail(parsedInput.taskId);
    },
    async unlinkResource(input) {
      const parsedInput = unlinkResourceInputSchema.parse(input);
      const detail = await getTaskDetail(parsedInput.taskId);
      const deleted = await dependencies.taskResourceRepository.unlink(parsedInput.linkId);
      if (!deleted) {
        throw new Error(`\u0421\u0432\u044F\u0437\u044C \u0440\u0435\u0441\u0443\u0440\u0441\u0430 ${parsedInput.linkId} \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430.`);
      }
      emitDataChanged({ reason: "unlink-resource", projectId: detail.task.projectId, taskId: parsedInput.taskId });
      return getTaskDetail(parsedInput.taskId);
    },
    async upsertPromptOverride(input) {
      const parsedInput = upsertPromptOverrideInputSchema.parse(input);
      return dependencies.promptOverrideRepository.upsert(parsedInput.id, parsedInput.template);
    },
    async listPromptOverrides() {
      return dependencies.promptOverrideRepository.list();
    },
    async deletePromptOverride(input) {
      const parsedInput = deletePromptOverrideInputSchema.parse(input);
      dependencies.promptOverrideRepository.delete(parsedInput.id);
    }
  };
}

// src/main/services/dev-logger.ts
function write(level, scope, message, meta) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const suffix = meta ? ` ${JSON.stringify(meta)}` : "";
  console.log(`[${timestamp}] [${level}] [${scope}] ${message}${suffix}`);
}
function createDevLogger() {
  return {
    debug(scope, message, meta) {
      write("debug", scope, message, meta);
    },
    error(scope, message, meta) {
      write("error", scope, message, meta);
    },
    info(scope, message, meta) {
      write("info", scope, message, meta);
    }
  };
}

// src/main/ipc/register-ipc-handlers.ts
var channels = {
  answerPlanQuestion: "app:answer-plan-question",
  appendPlanExtension: "app:append-plan-extension",
  appendPlanImprovement: "app:append-plan-improvement",
  consolidatePlanDiscussion: "app:consolidate-plan-discussion",
  createProject: "app:create-project",
  createResource: "app:create-resource",
  createTask: "app:create-task",
  deletePromptOverride: "app:delete-prompt-override",
  deleteResource: "app:delete-resource",
  deleteTask: "app:delete-task",
  exportData: "app:export-data",
  getHealth: "app:get-health",
  getProject: "app:get-project",
  getResource: "app:get-resource",
  getTaskDetail: "app:get-task-detail",
  importData: "app:import-data",
  linkResource: "app:link-resource",
  linkTask: "app:link-task",
  listPromptOverrides: "app:list-prompt-overrides",
  listProjects: "app:list-projects",
  listResources: "app:list-resources",
  listTasks: "app:list-tasks",
  restorePlanRevision: "app:restore-plan-revision",
  savePlan: "app:save-plan",
  unlinkResource: "app:unlink-resource",
  unlinkTask: "app:unlink-task",
  updateResource: "app:update-resource",
  updateTask: "app:update-task",
  updateTaskStatus: "app:update-task-status",
  updateProjectProfile: "app:update-project-profile",
  upsertPromptOverride: "app:upsert-prompt-override"
};
async function withIpcErrors(action) {
  try {
    return await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown IPC error";
    throw new Error(message);
  }
}
function registerIpcHandlers(ipcMain, appService) {
  ipcMain.handle(channels.exportData, () => withIpcErrors(() => appService.exportData()));
  ipcMain.handle(channels.getHealth, () => withIpcErrors(() => appService.getHealthSnapshot()));
  ipcMain.handle(channels.importData, () => withIpcErrors(() => appService.importData()));
  ipcMain.handle(channels.listProjects, () => withIpcErrors(() => appService.listProjects()));
  ipcMain.handle(channels.listTasks, () => withIpcErrors(() => appService.listTasks()));
  ipcMain.handle(
    channels.getProject,
    (_event, projectId) => withIpcErrors(() => appService.getProject(projectId))
  );
  ipcMain.handle(
    channels.getTaskDetail,
    (_event, taskId) => withIpcErrors(() => appService.getTaskDetail(taskId))
  );
  ipcMain.handle(
    channels.createProject,
    (_event, input) => withIpcErrors(() => appService.createProject(input))
  );
  ipcMain.handle(
    channels.createTask,
    (_event, input) => withIpcErrors(() => appService.createTask(input))
  );
  ipcMain.handle(
    channels.deleteTask,
    (_event, taskId) => withIpcErrors(() => appService.deleteTask(taskId))
  );
  ipcMain.handle(
    channels.restorePlanRevision,
    (_event, input) => withIpcErrors(() => appService.restorePlanRevision(input))
  );
  ipcMain.handle(
    channels.savePlan,
    (_event, input) => withIpcErrors(() => appService.savePlan(input))
  );
  ipcMain.handle(
    channels.answerPlanQuestion,
    (_event, input) => withIpcErrors(() => appService.answerPlanQuestion(input))
  );
  ipcMain.handle(
    channels.appendPlanExtension,
    (_event, input) => withIpcErrors(() => appService.appendPlanExtension(input))
  );
  ipcMain.handle(
    channels.appendPlanImprovement,
    (_event, input) => withIpcErrors(() => appService.appendPlanImprovement(input))
  );
  ipcMain.handle(
    channels.consolidatePlanDiscussion,
    (_event, input) => withIpcErrors(() => appService.consolidatePlanDiscussion(input))
  );
  ipcMain.handle(
    channels.updateTask,
    (_event, input) => withIpcErrors(() => appService.updateTask(input))
  );
  ipcMain.handle(
    channels.updateTaskStatus,
    (_event, input) => withIpcErrors(() => appService.updateTaskStatus(input))
  );
  ipcMain.handle(
    channels.updateProjectProfile,
    (_event, input) => withIpcErrors(() => appService.updateProjectProfile(input))
  );
  ipcMain.handle(
    channels.linkTask,
    (_event, input) => withIpcErrors(() => appService.linkTask(input))
  );
  ipcMain.handle(
    channels.unlinkTask,
    (_event, input) => withIpcErrors(() => appService.unlinkTask(input))
  );
  ipcMain.handle(
    channels.listPromptOverrides,
    () => withIpcErrors(() => appService.listPromptOverrides())
  );
  ipcMain.handle(
    channels.upsertPromptOverride,
    (_event, input) => withIpcErrors(() => appService.upsertPromptOverride(input))
  );
  ipcMain.handle(
    channels.deletePromptOverride,
    (_event, input) => withIpcErrors(() => appService.deletePromptOverride(input))
  );
  ipcMain.handle(
    channels.createResource,
    (_event, input) => withIpcErrors(() => appService.createResource(input))
  );
  ipcMain.handle(
    channels.getResource,
    (_event, id) => withIpcErrors(() => appService.getResource(id))
  );
  ipcMain.handle(
    channels.listResources,
    () => withIpcErrors(() => appService.listResources())
  );
  ipcMain.handle(
    channels.updateResource,
    (_event, input) => withIpcErrors(() => appService.updateResource(input))
  );
  ipcMain.handle(
    channels.deleteResource,
    (_event, id) => withIpcErrors(() => appService.deleteResource(id))
  );
  ipcMain.handle(
    channels.linkResource,
    (_event, input) => withIpcErrors(() => appService.linkResource(input))
  );
  ipcMain.handle(
    channels.unlinkResource,
    (_event, input) => withIpcErrors(() => appService.unlinkResource(input))
  );
}

// src/main/mcp/mcp-http-server.ts
import { createServer } from "http";
import { randomUUID as randomUUID10 } from "crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

// src/main/mcp/create-mcp-server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// src/main/mcp/actions/plan-actions.ts
import { z as z2 } from "zod";

// src/main/services/task-context.ts
var TaskContext = class {
  taskId;
  appService;
  _detail = null;
  _resourceCache = /* @__PURE__ */ new Map();
  constructor(taskId, appService) {
    this.taskId = taskId;
    this.appService = appService;
  }
  // ─── Private helpers ────────────────────────────────────────────────────────
  async detail() {
    if (!this._detail) {
      this._detail = await this.appService.getTaskDetail(this.taskId);
    }
    return this._detail;
  }
  invalidate() {
    this._detail = null;
  }
  normalizeTaskContextList(items) {
    if (items === void 0) {
      return void 0;
    }
    const normalized = [];
    const seen = /* @__PURE__ */ new Set();
    for (const item of items) {
      const value = item.trim();
      if (value.length === 0 || seen.has(value)) {
        continue;
      }
      seen.add(value);
      normalized.push(value);
    }
    return normalized;
  }
  normalizeTaskContextInput(input) {
    if (!input) {
      return void 0;
    }
    const goal = this.normalizeTaskContextList(input.goal);
    const criticalConditions = this.normalizeTaskContextList(input.criticalConditions);
    const forbiddenInterpretations = this.normalizeTaskContextList(input.forbiddenInterpretations);
    const acceptanceCriteria = this.normalizeTaskContextList(input.acceptanceCriteria);
    if (goal === void 0 && criticalConditions === void 0 && forbiddenInterpretations === void 0 && acceptanceCriteria === void 0) {
      return void 0;
    }
    return {
      goal,
      criticalConditions,
      forbiddenInterpretations,
      acceptanceCriteria
    };
  }
  mergeTaskContext(current, input) {
    if (!input) {
      return void 0;
    }
    return {
      goal: input.goal ?? current.goal,
      criticalConditions: input.criticalConditions ?? current.criticalConditions,
      forbiddenInterpretations: input.forbiddenInterpretations ?? current.forbiddenInterpretations,
      acceptanceCriteria: input.acceptanceCriteria ?? current.acceptanceCriteria
    };
  }
  // ─── Task ────────────────────────────────────────────────────────────────────
  async getTask() {
    return (await this.detail()).task;
  }
  async updateStatus(status) {
    await this.appService.updateTaskStatus({ taskId: this.taskId, status });
    this.invalidate();
  }
  // ─── Plan ────────────────────────────────────────────────────────────────────
  async getPlan() {
    return (await this.detail()).plan;
  }
  async savePlan(contentMd, openQuestions, source = "agent", taskContext) {
    const detail = await this.detail();
    const normalizedTaskContext = this.normalizeTaskContextInput(taskContext);
    const mergedTaskContext = this.mergeTaskContext(detail.taskContext, normalizedTaskContext);
    await this.appService.savePlan({
      taskId: this.taskId,
      contentMd,
      openQuestions,
      source,
      goal: mergedTaskContext?.goal,
      criticalConditions: mergedTaskContext?.criticalConditions,
      forbiddenInterpretations: mergedTaskContext?.forbiddenInterpretations,
      acceptanceCriteria: mergedTaskContext?.acceptanceCriteria
    });
    this.invalidate();
  }
  async appendExtension(content, author = "agent") {
    await this.appService.appendPlanExtension({ taskId: this.taskId, content, author });
    this.invalidate();
  }
  async appendImprovement(content, author = "agent") {
    await this.appService.appendPlanImprovement({ taskId: this.taskId, content, author });
    this.invalidate();
  }
  async consolidateDiscussion(contentMd, openQuestions, source = "agent") {
    await this.appService.consolidatePlanDiscussion({
      taskId: this.taskId,
      contentMd,
      openQuestions,
      source
    });
    this.invalidate();
  }
  // ─── Plan comments ────────────────────────────────────────────────────────────
  async getPlanComments() {
    return (await this.detail()).planComments;
  }
  async getComment(commentId) {
    const comments = await this.getPlanComments();
    const item = comments.find((c) => c.id === commentId);
    if (!item) throw new Error(`\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 ${commentId} \u0434\u043B\u044F \u0437\u0430\u0434\u0430\u0447\u0438 ${this.taskId} \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D.`);
    return item;
  }
  // ─── Plan questions ───────────────────────────────────────────────────────────
  async getPlanQuestions() {
    return (await this.detail()).planQuestions;
  }
  async getTaskContext() {
    return (await this.detail()).taskContext;
  }
  async getQuestion(questionId) {
    const questions = await this.getPlanQuestions();
    const item = questions.find((q) => q.id === questionId);
    if (!item) throw new Error(`\u0412\u043E\u043F\u0440\u043E\u0441 ${questionId} \u0434\u043B\u044F \u0437\u0430\u0434\u0430\u0447\u0438 ${this.taskId} \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D.`);
    return item;
  }
  async addQuestion(content) {
    await this.appService.addPlanQuestion({ taskId: this.taskId, content });
    this.invalidate();
  }
  async answerQuestion(questionId, answer) {
    await this.appService.answerPlanQuestion({ taskId: this.taskId, questionId, answer });
    this.invalidate();
  }
  // ─── Plan revisions (read, не попадают в MCP snapshot) ───────────────────────
  async getPlanRevisions() {
    return (await this.detail()).planRevisions;
  }
  // ─── Linked resources (read) ─────────────────────────────────────────────────
  async getLinkedResources() {
    return (await this.detail()).linkedResources;
  }
  async getResource(resourceId) {
    if (!this._resourceCache.has(resourceId)) {
      const resource = await this.appService.getResource(resourceId);
      this._resourceCache.set(resourceId, resource);
    }
    return this._resourceCache.get(resourceId);
  }
  // ─── Linked tasks (read) ─────────────────────────────────────────────────────
  async getLinkedTasks() {
    return (await this.detail()).linkedTasks;
  }
  // ─── Snapshot ────────────────────────────────────────────────────────────────
  async getSnapshot() {
    const detail = await this.detail();
    return {
      task: detail.task,
      plan: detail.plan,
      planComments: detail.planComments,
      planQuestions: detail.planQuestions,
      taskContext: detail.taskContext,
      linkedResources: detail.linkedResources,
      linkedTasks: detail.linkedTasks,
      project: detail.project
    };
  }
};
function createTaskContext(taskId, appService) {
  return new TaskContext(taskId, appService);
}

// src/main/mcp/agent-session.ts
var SESSION_STALE_MS = 100 * 60 * 1e3;
var SESSION_STALE_INTERACTIONS = 30;
var SESSION_LOST_MS = 600 * 60 * 1e3;
function createFreshSession(runId) {
  return {
    taskId: null,
    lastContextVersion: null,
    state: "fresh",
    lastUsedAt: Date.now(),
    interactionCount: 0,
    lastMode: null,
    runId
  };
}
function generateRunId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function touchSession(session, patch) {
  const now = Date.now();
  let state = session.state;
  let interactionCount = session.interactionCount;
  if (session.lastUsedAt !== null) {
    const idle = now - session.lastUsedAt;
    if (idle >= SESSION_LOST_MS) {
      state = "lost";
      interactionCount = 0;
    } else if (idle >= SESSION_STALE_MS) {
      state = "stale";
    }
  }
  if (state === "fresh" && interactionCount >= SESSION_STALE_INTERACTIONS) {
    state = "stale";
  }
  return {
    ...session,
    state,
    lastUsedAt: now,
    lastContextVersion: now,
    interactionCount: interactionCount + 1,
    taskId: patch.taskId !== void 0 ? patch.taskId : session.taskId,
    lastMode: patch.mode !== void 0 ? patch.mode : session.lastMode
  };
}
function startWork(session, taskId) {
  const now = Date.now();
  return {
    ...session,
    taskId,
    lastContextVersion: now,
    lastUsedAt: now,
    lastMode: "work",
    state: "fresh",
    interactionCount: session.interactionCount + 1
  };
}
function toDeltaMode(session) {
  const now = Date.now();
  return {
    ...session,
    lastMode: "delta",
    lastUsedAt: now,
    lastContextVersion: now,
    interactionCount: session.interactionCount + 1
  };
}

// src/main/mcp/controller/mcp-controller-context.ts
function textContent(text2) {
  return [{ type: "text", text: text2 }];
}
function findProjectsByQuery(projects, query, limit) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
  return projects.filter((project) => {
    const haystack = [
      project.id,
      project.name,
      project.description,
      project.rootPath ?? "",
      project.languages.join(" "),
      project.skillFilePath ?? ""
    ].join(" ").toLocaleLowerCase("ru-RU");
    return haystack.includes(normalizedQuery);
  }).slice(0, limit);
}
function findTasksByQuery(tasks, query, limit) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
  return tasks.filter((task) => {
    const haystack = [
      task.id,
      task.projectId,
      task.projectName,
      task.title,
      task.description,
      task.status
    ].join(" ").toLocaleLowerCase("ru-RU");
    return haystack.includes(normalizedQuery);
  }).slice(0, limit);
}
function resolveProjectReference(projects, projectRef) {
  const trimmedRef = projectRef.trim();
  const normalizedRef = normalizeProjectName(trimmedRef);
  const exactMatch = projects.find((project) => project.id === trimmedRef) ?? projects.find((project) => normalizeProjectName(project.name) === normalizedRef);
  if (exactMatch) {
    return { project: exactMatch, matches: [] };
  }
  const matches = findProjectsByQuery(projects, trimmedRef, 10);
  return {
    project: matches.length === 1 ? matches[0] : null,
    matches
  };
}
function getProjectProfileHint(project) {
  const missingFields = [];
  if (!project.description.trim()) {
    missingFields.push("description");
  }
  if (!project.rootPath?.trim()) {
    missingFields.push("rootPath");
  }
  if (project.languages.length === 0) {
    missingFields.push("languages");
  }
  if (missingFields.length === 0) {
    return `\u041F\u0440\u043E\u0444\u0438\u043B\u044C \u043F\u0440\u043E\u0435\u043A\u0442\u0430 ${project.name} \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D.`;
  }
  return `\u041F\u0440\u043E\u0444\u0438\u043B\u044C \u043F\u0440\u043E\u0435\u043A\u0442\u0430 ${project.name} \u043D\u0435 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D: ${missingFields.join(", ")}. \u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u044B\u0437\u043E\u0432\u0438\u0442\u0435 update_project_profile.`;
}
var McpControllerContext = class {
  constructor(appService, logger) {
    this.appService = appService;
    this.logger = logger;
  }
  activeProjectId = null;
  agentSession = createFreshSession(generateRunId());
  getAppService() {
    return this.appService;
  }
  getLogger() {
    return this.logger;
  }
  getActiveProjectId() {
    return this.activeProjectId;
  }
  setActiveProjectId(projectId) {
    this.activeProjectId = projectId;
  }
  resetSession() {
    this.agentSession = createFreshSession(generateRunId());
  }
  getAgentSession() {
    return this.agentSession;
  }
  updateAgentSession(next) {
    this.agentSession = next;
  }
  touchSession(patch) {
    this.agentSession = touchSession(this.agentSession, patch);
  }
  async requireActiveProject() {
    if (!this.activeProjectId) {
      throw new Error("\u041F\u0440\u043E\u0435\u043A\u0442 \u043D\u0435 \u0430\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u043D. \u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u044B\u0437\u043E\u0432\u0438\u0442\u0435 activate_project.");
    }
    const project = await this.appService.getProject(this.activeProjectId);
    if (!project) {
      this.activeProjectId = null;
      throw new Error("\u0410\u043A\u0442\u0438\u0432\u043D\u044B\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442. \u0410\u043A\u0442\u0438\u0432\u0438\u0440\u0443\u0439\u0442\u0435 \u043F\u0440\u043E\u0435\u043A\u0442 \u0437\u0430\u043D\u043E\u0432\u043E.");
    }
    return project;
  }
  async requirePreparedProject() {
    const project = await this.requireActiveProject();
    if (!project.isProfileComplete) {
      throw new Error(getProjectProfileHint(project));
    }
    return project;
  }
  async requireTaskContext(taskId) {
    await this.requirePreparedProject();
    return createTaskContext(taskId, this.appService);
  }
};

// src/main/mcp/actions/plan-actions.ts
function registerPlanActions(server, context) {
  server.registerTool(
    "answer_plan_question",
    {
      description: "\u041E\u0442\u0432\u0435\u0442\u0438\u0442\u044C \u043D\u0430 \u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0439 \u0432\u043E\u043F\u0440\u043E\u0441 \u043F\u043B\u0430\u043D\u0430 \u043F\u043E questionId. \u041E\u0442\u0432\u0435\u0442 \u043F\u0435\u0440\u0435\u043D\u043E\u0441\u0438\u0442\u0441\u044F \u0432 discussion, \u0432\u043E\u043F\u0440\u043E\u0441 \u0443\u0434\u0430\u043B\u044F\u0435\u0442\u0441\u044F \u0438\u0437 \u0441\u043F\u0438\u0441\u043A\u0430 \u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0445.",
      inputSchema: {
        taskId: z2.string(),
        questionId: z2.string().min(1),
        answer: z2.string().min(1)
      }
    },
    async ({ answer, questionId, taskId }) => {
      const taskContext = await context.requireTaskContext(taskId);
      context.getLogger().info("mcp", "Tool answer_plan_question called", { questionId, taskId });
      await taskContext.answerQuestion(questionId, answer);
      context.touchSession({ taskId });
      return {
        content: textContent("\u041E\u0442\u0432\u0435\u0442 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D.")
      };
    }
  );
  server.registerTool(
    "add_plan_questions",
    {
      description: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043E\u0434\u0438\u043D \u0438\u043B\u0438 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0445 \u0432\u043E\u043F\u0440\u043E\u0441\u043E\u0432 \u043A \u0437\u0430\u0434\u0430\u0447\u0435 \u0431\u0435\u0437 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u043F\u043B\u0430\u043D\u0430. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u043A\u043E\u0433\u0434\u0430 \u043D\u0443\u0436\u043D\u043E \u0443\u0442\u043E\u0447\u043D\u0438\u0442\u044C \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F \u0443 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F.",
      inputSchema: {
        taskId: z2.string(),
        questions: z2.array(z2.string().min(1)).min(1)
      }
    },
    async ({ questions, taskId }) => {
      const taskContext = await context.requireTaskContext(taskId);
      context.getLogger().info("mcp", "Tool add_plan_questions called", { taskId, count: questions.length });
      for (const content of questions) {
        await taskContext.addQuestion(content);
      }
      context.touchSession({ taskId });
      return {
        content: textContent(`\u0412\u043E\u043F\u0440\u043E\u0441\u044B \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u044B: ${questions.length}.`)
      };
    }
  );
  server.registerTool(
    "save_plan",
    {
      description: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C Markdown-\u043F\u043B\u0430\u043D \u0438 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u0441\u043F\u0438\u0441\u043E\u043A \u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0445 \u0432\u043E\u043F\u0440\u043E\u0441\u043E\u0432 \u0434\u043B\u044F \u0437\u0430\u0434\u0430\u0447\u0438 \u0432\u043D\u0443\u0442\u0440\u0438 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430.",
      inputSchema: {
        taskId: z2.string(),
        contentMd: z2.string().min(1),
        openQuestions: z2.array(z2.string().min(1)).optional(),
        goal: z2.array(z2.string().min(1)).optional(),
        criticalConditions: z2.array(z2.string().min(1)).optional(),
        forbiddenInterpretations: z2.array(z2.string().min(1)).optional(),
        acceptanceCriteria: z2.array(z2.string().min(1)).optional()
      }
    },
    async ({
      acceptanceCriteria,
      contentMd,
      criticalConditions,
      forbiddenInterpretations,
      goal,
      openQuestions,
      taskId
    }) => {
      const taskContext = await context.requireTaskContext(taskId);
      context.getLogger().info("mcp", "Tool save_plan called", {
        taskId,
        openQuestionsCount: openQuestions?.length ?? 0,
        goalCount: goal?.length ?? 0,
        criticalConditionsCount: criticalConditions?.length ?? 0,
        forbiddenInterpretationsCount: forbiddenInterpretations?.length ?? 0,
        acceptanceCriteriaCount: acceptanceCriteria?.length ?? 0
      });
      await taskContext.savePlan(contentMd, openQuestions, "agent", {
        goal,
        criticalConditions,
        forbiddenInterpretations,
        acceptanceCriteria
      });
      context.touchSession({ taskId });
      return {
        content: textContent("\u041F\u043B\u0430\u043D \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D.")
      };
    }
  );
  server.registerTool(
    "append_plan_extension",
    {
      description: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435 \u0442\u0435\u043A\u0443\u0449\u0435\u0433\u043E \u043F\u043B\u0430\u043D\u0430 \u0437\u0430\u0434\u0430\u0447\u0438 \u0431\u0435\u0437 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F \u043D\u043E\u0432\u043E\u0439 \u0440\u0435\u0432\u0438\u0437\u0438\u0438.",
      inputSchema: {
        taskId: z2.string(),
        content: z2.string().min(1)
      }
    },
    async ({ content, taskId }) => {
      const taskContext = await context.requireTaskContext(taskId);
      context.getLogger().info("mcp", "Tool append_plan_extension called", { taskId });
      await taskContext.appendExtension(content);
      context.touchSession({ taskId });
      return {
        content: textContent("\u0420\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E.")
      };
    }
  );
  server.registerTool(
    "append_plan_improvement",
    {
      description: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0434\u043E\u0440\u0430\u0431\u043E\u0442\u043A\u0443 \u043F\u043B\u0430\u043D\u0430 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u0431\u043B\u043E\u043A\u043E\u043C \u0431\u0435\u0437 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F \u043D\u043E\u0432\u043E\u0439 \u0440\u0435\u0432\u0438\u0437\u0438\u0438.",
      inputSchema: {
        taskId: z2.string(),
        content: z2.string().min(1)
      }
    },
    async ({ content, taskId }) => {
      const taskContext = await context.requireTaskContext(taskId);
      context.getLogger().info("mcp", "Tool append_plan_improvement called", { taskId });
      await taskContext.appendImprovement(content);
      context.touchSession({ taskId });
      return {
        content: textContent("\u0414\u043E\u0440\u0430\u0431\u043E\u0442\u043A\u0430 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0430.")
      };
    }
  );
  server.registerTool(
    "consolidate_plan_discussion",
    {
      description: "\u0421\u0436\u0430\u0442\u044C \u043F\u0435\u0440\u0435\u043F\u0438\u0441\u043A\u0443 \u043F\u043E \u043F\u043B\u0430\u043D\u0443 \u0432 \u043D\u043E\u0432\u044B\u0439 Markdown-\u043F\u043B\u0430\u043D, \u043F\u0440\u0438 \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E\u0441\u0442\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043D\u043E\u0432\u044B\u0439 \u0441\u043F\u0438\u0441\u043E\u043A \u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0445 \u0432\u043E\u043F\u0440\u043E\u0441\u043E\u0432 \u0438 \u043E\u0447\u0438\u0441\u0442\u0438\u0442\u044C \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0435 \u0431\u043B\u043E\u043A\u0438 \u043E\u0431\u0441\u0443\u0436\u0434\u0435\u043D\u0438\u044F.",
      inputSchema: {
        taskId: z2.string(),
        contentMd: z2.string().min(1),
        openQuestions: z2.array(z2.string().min(1)).optional()
      }
    },
    async ({ contentMd, openQuestions, taskId }) => {
      const taskContext = await context.requireTaskContext(taskId);
      context.getLogger().info("mcp", "Tool consolidate_plan_discussion called", {
        taskId,
        openQuestionsCount: openQuestions?.length ?? 0
      });
      await taskContext.consolidateDiscussion(contentMd, openQuestions, "agent");
      context.touchSession({ taskId });
      return {
        content: textContent("\u041E\u0431\u0441\u0443\u0436\u0434\u0435\u043D\u0438\u0435 \u0441\u0436\u0430\u0442\u043E.")
      };
    }
  );
}

// src/main/mcp/actions/project-actions.ts
import { z as z3 } from "zod";

// src/main/mcp/mcp-response-presenters.ts
function serializeProjectSummary(project) {
  return {
    id: project.id,
    isProfileComplete: project.isProfileComplete,
    name: project.name
  };
}
function serializeActiveProject(project) {
  return {
    description: project.description,
    id: project.id,
    isProfileComplete: project.isProfileComplete,
    languages: project.languages,
    name: project.name,
    rootPath: project.rootPath,
    skillFilePath: project.skillFilePath
  };
}
function serializeProjectCollection(projects, activeProjectId) {
  return {
    activeProjectId,
    projects: projects.map(serializeProjectSummary)
  };
}
function serializeActivatedProject(project) {
  return {
    activeProjectId: project.id,
    project: serializeProjectSummary(project)
  };
}
function serializeTask(task) {
  return {
    description: task.description,
    id: task.id,
    projectId: task.projectId,
    projectName: task.projectName,
    status: task.status,
    title: task.title,
    updatedAt: task.updatedAt
  };
}
function serializeLinkedTask(link) {
  return {
    comment: link.comment,
    direction: link.direction,
    projectName: link.projectName,
    status: link.status,
    taskId: link.taskId,
    title: link.title
  };
}
function serializeLinkedResource(link) {
  return {
    comment: link.comment,
    name: link.name,
    readHint: `\u0414\u043B\u044F \u0447\u0442\u0435\u043D\u0438\u044F \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u0433\u043E \u0432\u044B\u0437\u043E\u0432\u0438 get_resource \u0441 id "${link.resourceId}".`,
    resourceId: link.resourceId
  };
}
function serializePlanComment(comment) {
  return {
    author: comment.author,
    content: comment.content,
    id: comment.id,
    kind: comment.kind,
    updatedAt: comment.updatedAt
  };
}
function serializePlanQuestion(question) {
  return {
    answer: question.answer,
    answeredAt: question.answeredAt,
    content: question.content,
    id: question.id,
    updatedAt: question.updatedAt
  };
}
function serializePlanBlock(plan, comments, questions, taskContext) {
  if (!plan) {
    return {
      exists: false,
      contentMd: "",
      comments: [],
      questions: [],
      goal: taskContext.goal,
      criticalConditions: taskContext.criticalConditions,
      forbiddenInterpretations: taskContext.forbiddenInterpretations,
      acceptanceCriteria: taskContext.acceptanceCriteria
    };
  }
  return {
    exists: true,
    contentMd: plan.contentMd,
    source: plan.source,
    updatedAt: plan.updatedAt,
    comments: comments.map(serializePlanComment),
    questions: questions.map(serializePlanQuestion),
    goal: taskContext.goal,
    criticalConditions: taskContext.criticalConditions,
    forbiddenInterpretations: taskContext.forbiddenInterpretations,
    acceptanceCriteria: taskContext.acceptanceCriteria
  };
}
function serializeTaskDetail(detail) {
  return {
    linkedResources: detail.linkedResources.map(serializeLinkedResource),
    linkedTasks: detail.linkedTasks.map(serializeLinkedTask),
    plan: serializePlanBlock(detail.plan, detail.planComments, detail.planQuestions, detail.taskContext),
    project: serializeProjectSummary(detail.project),
    task: serializeTask(detail.task)
  };
}
function serializeTaskCollection(tasks, project) {
  return {
    project: project ? serializeProjectSummary(project) : null,
    tasks: tasks.map(serializeTask)
  };
}
function serializeResource(resource) {
  return {
    contentMd: resource.contentMd,
    id: resource.id,
    name: resource.name
  };
}
function serializeResourceCollection(resources) {
  return {
    resources: resources.map(serializeResource)
  };
}
function serializeTaskSnapshot(snapshot) {
  return {
    task: serializeTask(snapshot.task),
    project: serializeProjectSummary(snapshot.project),
    plan: serializePlanBlock(
      snapshot.plan,
      snapshot.planComments,
      snapshot.planQuestions,
      snapshot.taskContext
    ),
    linkedResources: snapshot.linkedResources.map(serializeLinkedResource),
    linkedTasks: snapshot.linkedTasks.map(serializeLinkedTask)
  };
}
var UNCHANGED = { unchanged: true };
function serializeDeltaSnapshot(snapshot, since) {
  const sinceDate = new Date(since).toISOString();
  const taskUpdated = new Date(snapshot.task.updatedAt).getTime() > since;
  const task = taskUpdated ? serializeTask(snapshot.task) : UNCHANGED;
  const planUpdated = snapshot.plan !== null && new Date(snapshot.plan.updatedAt).getTime() > since;
  const newComments = snapshot.planComments.filter((c) => new Date(c.updatedAt).getTime() > since);
  const newQuestions = snapshot.planQuestions.filter((q) => new Date(q.updatedAt).getTime() > since);
  const plan = planUpdated || newComments.length > 0 || newQuestions.length > 0 ? {
    ...planUpdated && snapshot.plan ? {
      contentMd: snapshot.plan.contentMd,
      updatedAt: snapshot.plan.updatedAt,
      goal: snapshot.taskContext.goal,
      criticalConditions: snapshot.taskContext.criticalConditions,
      forbiddenInterpretations: snapshot.taskContext.forbiddenInterpretations,
      acceptanceCriteria: snapshot.taskContext.acceptanceCriteria
    } : UNCHANGED,
    comments: newComments.length > 0 ? newComments.map(serializePlanComment) : UNCHANGED,
    questions: newQuestions.length > 0 ? newQuestions.map(serializePlanQuestion) : UNCHANGED
  } : UNCHANGED;
  const newLinkedResources = snapshot.linkedResources.filter(
    (r) => new Date(r.createdAt).getTime() > since
  );
  const linkedResources = newLinkedResources.length > 0 ? newLinkedResources.map(serializeLinkedResource) : UNCHANGED;
  const newLinkedTasks = snapshot.linkedTasks.filter(
    (t) => new Date(t.createdAt).getTime() > since
  );
  const linkedTasks = newLinkedTasks.length > 0 ? newLinkedTasks.map(serializeLinkedTask) : UNCHANGED;
  return { delta: true, since: sinceDate, task, plan, linkedResources, linkedTasks };
}
function serializeAgentSession(session) {
  return {
    interactionCount: session.interactionCount,
    lastContextVersion: session.lastContextVersion,
    lastMode: session.lastMode,
    lastUsedAt: session.lastUsedAt,
    runId: session.runId,
    state: session.state,
    taskId: session.taskId
  };
}

// src/main/mcp/actions/project-actions.ts
function registerProjectActions(server, context) {
  server.registerTool(
    "create_project",
    {
      description: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u043E\u0432\u044B\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u0434\u043B\u044F \u0434\u0430\u043B\u044C\u043D\u0435\u0439\u0448\u0435\u0439 \u0440\u0430\u0431\u043E\u0442\u044B \u0441 \u0437\u0430\u0434\u0430\u0447\u0430\u043C\u0438.",
      inputSchema: {
        name: z3.string().min(2).max(80)
      }
    },
    async ({ name }) => {
      context.getLogger().info("mcp", "Tool create_project called", { name });
      const project = await context.getAppService().createProject({ name });
      return {
        content: textContent("\u041F\u0440\u043E\u0435\u043A\u0442 \u0441\u043E\u0437\u0434\u0430\u043D."),
        structuredContent: serializeActiveProject(project)
      };
    }
  );
  server.registerTool(
    "list_projects",
    {
      description: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0441\u043F\u0438\u0441\u043E\u043A \u0432\u0441\u0435\u0445 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432, \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0445 \u0432 AITasker."
    },
    async () => {
      context.getLogger().debug("mcp", "Tool list_projects called");
      const projects = await context.getAppService().listProjects();
      const response = serializeProjectCollection(projects, context.getActiveProjectId());
      return {
        content: textContent(JSON.stringify(response, null, 2)),
        structuredContent: response
      };
    }
  );
  server.registerTool(
    "find_projects",
    {
      description: "\u041D\u0430\u0439\u0442\u0438 \u043F\u0440\u043E\u0435\u043A\u0442 \u043F\u043E id, \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E, \u043F\u0443\u0442\u0438 \u0438\u043B\u0438 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u044E \u043F\u0435\u0440\u0435\u0434 \u0430\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u0435\u0439.",
      inputSchema: {
        query: z3.string().min(1),
        limit: z3.number().int().min(1).max(20).optional()
      }
    },
    async ({ limit, query }) => {
      context.getLogger().debug("mcp", "Tool find_projects called", { query, limit: limit ?? 5 });
      const projects = await context.getAppService().listProjects();
      const matches = findProjectsByQuery(projects, query, limit ?? 5);
      const response = serializeProjectCollection(matches, context.getActiveProjectId());
      return {
        content: textContent(JSON.stringify(response, null, 2)),
        structuredContent: response
      };
    }
  );
  server.registerTool(
    "activate_project",
    {
      description: "\u0410\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442 \u0432 \u0442\u0435\u043A\u0443\u0449\u0435\u0439 MCP-\u0441\u0435\u0441\u0441\u0438\u0438. \u041F\u043E\u0441\u043B\u0435 \u0430\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u0438 \u0430\u0433\u0435\u043D\u0442 \u0434\u043E\u043B\u0436\u0435\u043D \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0438 \u0437\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443 \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0447\u0435\u0440\u0435\u0437 update_project_profile.",
      inputSchema: {
        projectRef: z3.string().min(1)
      }
    },
    async ({ projectRef }) => {
      context.getLogger().info("mcp", "Tool activate_project called", { projectRef });
      const projects = await context.getAppService().listProjects();
      const resolved = resolveProjectReference(projects, projectRef);
      if (!resolved.project && resolved.matches.length > 1) {
        throw new Error(
          `\u041D\u0430\u0439\u0434\u0435\u043D\u043E \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432 \u043F\u043E \u0437\u0430\u043F\u0440\u043E\u0441\u0443 "${projectRef}". \u0423\u0442\u043E\u0447\u043D\u0438\u0442\u0435 \u043F\u0440\u043E\u0435\u043A\u0442 \u0447\u0435\u0440\u0435\u0437 id \u0438\u043B\u0438 \u0442\u043E\u0447\u043D\u043E\u0435 \u0438\u043C\u044F.`
        );
      }
      if (!resolved.project) {
        throw new Error(`\u041F\u0440\u043E\u0435\u043A\u0442 "${projectRef}" \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D.`);
      }
      context.setActiveProjectId(resolved.project.id);
      context.resetSession();
      return {
        content: textContent("\u041F\u0440\u043E\u0435\u043A\u0442 \u0430\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u043D."),
        structuredContent: serializeActivatedProject(resolved.project)
      };
    }
  );
  server.registerTool(
    "get_active_project",
    {
      description: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u0442\u0435\u043A\u0443\u0449\u0435\u0439 MCP-\u0441\u0435\u0441\u0441\u0438\u0438 \u0432\u043C\u0435\u0441\u0442\u0435 \u0441 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u043E\u0439 \u043F\u0440\u043E\u0444\u0438\u043B\u044F."
    },
    async () => {
      context.getLogger().debug("mcp", "Tool get_active_project called");
      const project = await context.requireActiveProject();
      const response = serializeActiveProject(project);
      return {
        content: textContent(JSON.stringify(response, null, 2)),
        structuredContent: response
      };
    }
  );
  server.registerTool(
    "update_project_profile",
    {
      description: "\u0417\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u0438\u043B\u0438 \u0443\u0442\u043E\u0447\u043D\u0438\u0442\u044C \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430: \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435, \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435, \u043F\u0443\u0442\u044C, \u044F\u0437\u044B\u043A\u0438 \u0438 \u043F\u0443\u0442\u044C \u043A SKILL.md.",
      inputSchema: {
        name: z3.string().min(2).max(80).optional(),
        description: z3.string().max(4e3).optional(),
        rootPath: z3.string().min(1).max(500).nullable().optional(),
        languages: z3.array(z3.string().min(1).max(40)).max(20).optional(),
        skillFilePath: z3.string().min(1).max(500).nullable().optional(),
        skillPrompt: z3.string().max(4e3).optional()
      }
    },
    async (input) => {
      const project = await context.requireActiveProject();
      context.getLogger().info("mcp", "Tool update_project_profile called", { projectId: project.id });
      await context.getAppService().updateProjectProfile({
        projectId: project.id,
        ...input
      });
      return {
        content: textContent("\u041F\u0440\u043E\u0444\u0438\u043B\u044C \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D.")
      };
    }
  );
}

// src/main/mcp/actions/prompt-actions.ts
import { z as z4 } from "zod";

// src/renderer/components/mcp-prompt-presets.ts
function buildRegisteredPromptMessage(promptId, args) {
  if (promptId === "plan_task") {
    return `\u0412\u044B\u043F\u043E\u043B\u043D\u0438 \u043F\u043B\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u0437\u0430\u0434\u0430\u0447\u0438 \u0432 AITasker \u0447\u0435\u0440\u0435\u0437 MCP aitasker.

\u041F\u0440\u043E\u0435\u043A\u0442: ${args.projectRef}
\u0417\u0430\u0434\u0430\u0447\u0430: ${args.taskRef ?? ""}

\u0428\u0430\u0433\u0438:
1. \u0410\u043A\u0442\u0438\u0432\u0438\u0440\u0443\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u0447\u0435\u0440\u0435\u0437 activate_project.
2. \u041D\u0430\u0439\u0434\u0438 \u0437\u0430\u0434\u0430\u0447\u0443 \u0438 \u043F\u043E\u043B\u0443\u0447\u0438 \u0435\u0451 \u0434\u0430\u043D\u043D\u044B\u0435 \u0447\u0435\u0440\u0435\u0437 sync_task \u2014 \u044D\u0442\u043E \u043F\u0435\u0440\u0435\u0432\u0435\u0434\u0451\u0442 \u0441\u0435\u0441\u0441\u0438\u044E \u0432 work-\u0440\u0435\u0436\u0438\u043C.
3. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439 linkedResources \u0447\u0435\u0440\u0435\u0437 get_resource \u0435\u0441\u043B\u0438 \u043E\u043D\u0438 \u0432\u043B\u0438\u044F\u044E\u0442 \u043D\u0430 \u0437\u0430\u0434\u0430\u0447\u0443.
4. \u0415\u0441\u043B\u0438 \u0435\u0441\u0442\u044C \u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0435 \u0432\u043E\u043F\u0440\u043E\u0441\u044B (plan.questions) \u2014 \u043E\u0442\u0432\u0435\u0442\u044C \u0447\u0435\u0440\u0435\u0437 answer_plan_question \u0438\u043B\u0438 \u043E\u0441\u0442\u0430\u0432\u044C \u043D\u0435\u0440\u0435\u0448\u0451\u043D\u043D\u044B\u0435 \u0432 openQuestions \u043F\u0440\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0438.
5. \u0421\u043E\u0441\u0442\u0430\u0432\u044C \u043F\u043B\u0430\u043D \u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0438 \u0447\u0435\u0440\u0435\u0437 save_plan, \u043F\u0435\u0440\u0435\u0434\u0430\u0432 openQuestions \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u043C\u0430\u0441\u0441\u0438\u0432\u043E\u043C.
6. \u041F\u0435\u0440\u0435\u0432\u0435\u0434\u0438 \u0441\u0442\u0430\u0442\u0443\u0441 \u0437\u0430\u0434\u0430\u0447\u0438 \u0432 planning, \u0437\u0430\u0442\u0435\u043C \u0432 implementation \u0447\u0435\u0440\u0435\u0437 update_task_status.

${args.instructions?.trim() ? `\u0414\u043E\u043F. \u0438\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0438: ${args.instructions.trim()}` : ""}

\u041D\u0435 \u043E\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0439\u0441\u044F \u043D\u0430 \u0430\u043D\u0430\u043B\u0438\u0437\u0435. \u0421\u043E\u0445\u0440\u0430\u043D\u0438 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0432 AITasker \u0434\u043E \u0444\u0438\u043D\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u043E\u0442\u0432\u0435\u0442\u0430.`;
  }
  if (promptId === "compress_plan_discussion") {
    return `\u0421\u043E\u0436\u043C\u0438 \u043E\u0431\u0441\u0443\u0436\u0434\u0435\u043D\u0438\u0435 \u0437\u0430\u0434\u0430\u0447\u0438 \u0432 \u043E\u0431\u043D\u043E\u0432\u043B\u0451\u043D\u043D\u044B\u0439 \u043F\u043B\u0430\u043D \u0432 AITasker \u0447\u0435\u0440\u0435\u0437 MCP aitasker.

\u041F\u0440\u043E\u0435\u043A\u0442: ${args.projectRef}
\u0417\u0430\u0434\u0430\u0447\u0430: ${args.taskRef ?? ""}

\u0428\u0430\u0433\u0438:
1. \u0410\u043A\u0442\u0438\u0432\u0438\u0440\u0443\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u0447\u0435\u0440\u0435\u0437 activate_project.
2. \u041F\u043E\u043B\u0443\u0447\u0438 \u0434\u0430\u043D\u043D\u044B\u0435 \u0437\u0430\u0434\u0430\u0447\u0438 \u0447\u0435\u0440\u0435\u0437 sync_task.
3. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439 \u0432\u0441\u0435 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0438 (plan.comments) \u0438 \u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0435 \u0432\u043E\u043F\u0440\u043E\u0441\u044B (plan.questions).
4. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439 linkedResources \u0447\u0435\u0440\u0435\u0437 get_resource \u0435\u0441\u043B\u0438 \u043D\u0443\u0436\u043D\u044B \u0434\u043B\u044F \u043F\u043E\u043D\u0438\u043C\u0430\u043D\u0438\u044F.
5. \u0415\u0441\u043B\u0438 \u043D\u0430 \u0432\u043E\u043F\u0440\u043E\u0441\u044B \u0435\u0441\u0442\u044C \u043E\u0442\u0432\u0435\u0442\u044B \u2014 \u0441\u043E\u0445\u0440\u0430\u043D\u0438 \u0447\u0435\u0440\u0435\u0437 answer_plan_question.
6. \u0421\u043E\u0431\u0435\u0440\u0438 \u043E\u0431\u043D\u043E\u0432\u043B\u0451\u043D\u043D\u044B\u0439 \u043F\u043B\u0430\u043D \u0438\u0437 \u0431\u0430\u0437\u043E\u0432\u043E\u0433\u043E \u043F\u043B\u0430\u043D\u0430 + \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0438 + \u0440\u0435\u0448\u0451\u043D\u043D\u044B\u0435 \u0432\u043E\u043F\u0440\u043E\u0441\u044B.
7. \u0421\u043E\u0445\u0440\u0430\u043D\u0438 \u0447\u0435\u0440\u0435\u0437 consolidate_plan_discussion, \u043D\u0435\u0440\u0435\u0448\u0451\u043D\u043D\u044B\u0435 \u0432\u043E\u043F\u0440\u043E\u0441\u044B \u043F\u0435\u0440\u0435\u0434\u0430\u0439 \u0432 openQuestions.

${args.instructions?.trim() ? `\u0414\u043E\u043F. \u0438\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0438: ${args.instructions.trim()}` : ""}

\u041D\u0435 \u043E\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0439\u0441\u044F \u043D\u0430 \u0430\u043D\u0430\u043B\u0438\u0437\u0435. \u041E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E \u0441\u043E\u0445\u0440\u0430\u043D\u0438 \u043E\u0431\u043D\u043E\u0432\u043B\u0451\u043D\u043D\u044B\u0439 \u043F\u043B\u0430\u043D \u0434\u043E \u0444\u0438\u043D\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u043E\u0442\u0432\u0435\u0442\u0430.`;
  }
  return `\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u044C \u0438\u043B\u0438 \u043E\u0431\u043D\u043E\u0432\u0438 SKILL.md \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0432 AITasker \u0447\u0435\u0440\u0435\u0437 MCP aitasker.

\u041F\u0440\u043E\u0435\u043A\u0442: ${args.projectRef}
${args.skillPath?.trim() ? `\u041F\u0443\u0442\u044C \u043A SKILL.md: ${args.skillPath.trim()}` : ""}

\u0428\u0430\u0433\u0438:
1. \u0410\u043A\u0442\u0438\u0432\u0438\u0440\u0443\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u0447\u0435\u0440\u0435\u0437 activate_project \u0438 \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0439 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443.
2. \u041E\u043F\u0440\u0435\u0434\u0435\u043B\u0438 \u043F\u0443\u0442\u044C \u043A SKILL.md \u0438\u0437 skillFilePath \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0438\u043B\u0438 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 <rootPath>/SKILL.md.
3. \u0421\u043E\u0437\u0434\u0430\u0439 \u0438\u043B\u0438 \u043E\u0431\u043D\u043E\u0432\u0438 \u0444\u0430\u0439\u043B SKILL.md \u0441 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435\u043C \u0441\u0442\u0435\u043A\u0430, \u043A\u043E\u043D\u0432\u0435\u043D\u0446\u0438\u0439 \u0438 \u043E\u0441\u043E\u0431\u0435\u043D\u043D\u043E\u0441\u0442\u0435\u0439 \u043F\u0440\u043E\u0435\u043A\u0442\u0430.
4. \u0421\u043E\u0445\u0440\u0430\u043D\u0438 \u043F\u0443\u0442\u044C \u043A \u0444\u0430\u0439\u043B\u0443 \u0447\u0435\u0440\u0435\u0437 update_project_profile.

${args.instructions?.trim() ? `\u0414\u043E\u043F. \u0438\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0438: ${args.instructions.trim()}` : ""}

\u0415\u0441\u043B\u0438 \u043F\u0443\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u043D\u0430\u0434\u0451\u0436\u043D\u043E, \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0441\u044C \u0438 \u0437\u0430\u043F\u0440\u043E\u0441\u0438 \u0435\u0433\u043E \u0443 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F.`;
}

// src/main/mcp/actions/prompt-actions.ts
function registerPromptActions(server) {
  server.registerPrompt(
    "plan_task",
    {
      description: "\u041F\u0440\u043E\u0432\u0435\u0441\u0442\u0438 planning \u0437\u0430\u0434\u0430\u0447\u0438 \u0438\u0437 AITasker \u0432\u043D\u0443\u0442\u0440\u0438 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C Markdown-\u043F\u043B\u0430\u043D \u043E\u0431\u0440\u0430\u0442\u043D\u043E.",
      argsSchema: {
        projectRef: z4.string().min(1).describe("Id \u0438\u043B\u0438 \u0447\u0438\u0442\u0430\u0435\u043C\u043E\u0435 \u0438\u043C\u044F \u043F\u0440\u043E\u0435\u043A\u0442\u0430, \u0432\u043D\u0443\u0442\u0440\u0438 \u043A\u043E\u0442\u043E\u0440\u043E\u0433\u043E \u043D\u0443\u0436\u043D\u043E \u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C."),
        taskRef: z4.string().min(1).describe("Id \u0437\u0430\u0434\u0430\u0447\u0438 \u0438\u043B\u0438 \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u043E\u0447\u0438\u0442\u0430\u0435\u043C\u043E\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0437\u0430\u0434\u0430\u0447\u0438 \u0438\u0437 \u0437\u0430\u043F\u0440\u043E\u0441\u0430 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F."),
        instructions: z4.string().optional().describe("\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u044F \u0438\u043B\u0438 \u043F\u043E\u0436\u0435\u043B\u0430\u043D\u0438\u044F \u043A \u043F\u043B\u0430\u043D\u0443.")
      }
    },
    async ({ instructions, projectRef, taskRef }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: buildRegisteredPromptMessage("plan_task", { instructions, projectRef, taskRef })
          }
        }
      ]
    })
  );
  server.registerPrompt(
    "compress_plan_discussion",
    {
      description: "\u0421\u0436\u0430\u0442\u044C \u043F\u0435\u0440\u0435\u043F\u0438\u0441\u043A\u0443 \u043F\u043E \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u044F\u043C \u0438 \u0434\u043E\u0440\u0430\u0431\u043E\u0442\u043A\u0430\u043C \u0437\u0430\u0434\u0430\u0447\u0438 \u0432 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0439 Markdown-\u043F\u043B\u0430\u043D \u0438 \u043E\u0447\u0438\u0441\u0442\u0438\u0442\u044C \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0435 discussion-\u0431\u043B\u043E\u043A\u0438.",
      argsSchema: {
        projectRef: z4.string().min(1).describe("Id \u0438\u043B\u0438 \u0447\u0438\u0442\u0430\u0435\u043C\u043E\u0435 \u0438\u043C\u044F \u043F\u0440\u043E\u0435\u043A\u0442\u0430, \u0432\u043D\u0443\u0442\u0440\u0438 \u043A\u043E\u0442\u043E\u0440\u043E\u0433\u043E \u043D\u0443\u0436\u043D\u043E \u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C."),
        taskRef: z4.string().min(1).describe("Id \u0437\u0430\u0434\u0430\u0447\u0438 \u0438\u043B\u0438 \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u043E\u0447\u0438\u0442\u0430\u0435\u043C\u043E\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0437\u0430\u0434\u0430\u0447\u0438 \u0438\u0437 \u0437\u0430\u043F\u0440\u043E\u0441\u0430 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F."),
        instructions: z4.string().optional().describe("\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u044F \u043A \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u043C\u0443 \u043F\u043B\u0430\u043D\u0443 \u043F\u043E\u0441\u043B\u0435 \u0441\u0436\u0430\u0442\u0438\u044F \u043F\u0435\u0440\u0435\u043F\u0438\u0441\u043A\u0438.")
      }
    },
    async ({ instructions, projectRef, taskRef }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: buildRegisteredPromptMessage("compress_plan_discussion", { instructions, projectRef, taskRef })
          }
        }
      ]
    })
  );
  server.registerPrompt(
    "create_project_skill",
    {
      description: "\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u044C \u0438\u043B\u0438 \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u044C SKILL.md \u0434\u043B\u044F \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430, \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043F\u0443\u0442\u044C \u043A \u043D\u0435\u043C\u0443 \u0432 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0435 \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0438 \u0437\u0430\u0442\u0435\u043C \u043A\u0440\u0430\u0442\u043A\u043E \u043E\u0442\u0447\u0438\u0442\u0430\u0442\u044C\u0441\u044F.",
      argsSchema: {
        projectRef: z4.string().min(1).describe("Id \u0438\u043B\u0438 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043F\u0440\u043E\u0435\u043A\u0442\u0430, \u0434\u043B\u044F \u043A\u043E\u0442\u043E\u0440\u043E\u0433\u043E \u043D\u0443\u0436\u043D\u043E \u0441\u043E\u0437\u0434\u0430\u0442\u044C skill."),
        skillPath: z4.string().optional().describe("\u041D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u043F\u0443\u0442\u044C \u043A SKILL.md. \u0415\u0441\u043B\u0438 \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D, \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 skillFilePath \u0438\u0437 \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0438\u043B\u0438 <rootPath>/SKILL.md."),
        instructions: z4.string().optional().describe("\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F \u043A \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u043C\u0443 skill-\u0444\u0430\u0439\u043B\u0430.")
      }
    },
    async ({ instructions, projectRef, skillPath }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: buildRegisteredPromptMessage("create_project_skill", { instructions, projectRef, skillPath })
          }
        }
      ]
    })
  );
}

// src/main/mcp/actions/resource-actions.ts
import { z as z5 } from "zod";
function registerResourceActions(server, context) {
  server.registerTool(
    "create_resource",
    {
      description: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u043E\u0432\u044B\u0439 \u0433\u043B\u043E\u0431\u0430\u043B\u044C\u043D\u044B\u0439 \u0440\u0435\u0441\u0443\u0440\u0441 (Markdown-\u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442) \u043D\u0435 \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u043D\u043D\u044B\u0439 \u043A \u043F\u0440\u043E\u0435\u043A\u0442\u0443.",
      inputSchema: {
        name: z5.string().min(1).max(200),
        contentMd: z5.string().optional()
      }
    },
    async ({ name, contentMd }) => {
      context.getLogger().info("mcp", "Tool create_resource called", { name });
      const resource = await context.getAppService().createResource({ name, contentMd });
      return {
        content: textContent("\u0420\u0435\u0441\u0443\u0440\u0441 \u0441\u043E\u0437\u0434\u0430\u043D."),
        structuredContent: serializeResource(resource)
      };
    }
  );
  server.registerTool(
    "get_resource",
    {
      description: "\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0440\u0435\u0441\u0443\u0440\u0441 \u043F\u043E id.",
      inputSchema: {
        id: z5.string()
      }
    },
    async ({ id }) => {
      context.getLogger().debug("mcp", "Tool get_resource called", { id });
      const resource = await context.getAppService().getResource(id);
      const response = serializeResource(resource);
      return {
        content: textContent(JSON.stringify(response, null, 2)),
        structuredContent: response
      };
    }
  );
  server.registerTool(
    "list_resources",
    {
      description: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0441\u043F\u0438\u0441\u043E\u043A \u0432\u0441\u0435\u0445 \u0433\u043B\u043E\u0431\u0430\u043B\u044C\u043D\u044B\u0445 \u0440\u0435\u0441\u0443\u0440\u0441\u043E\u0432."
    },
    async () => {
      context.getLogger().debug("mcp", "Tool list_resources called");
      const resources = await context.getAppService().listResources();
      const response = serializeResourceCollection(resources);
      return {
        content: textContent(JSON.stringify(response, null, 2)),
        structuredContent: response
      };
    }
  );
  server.registerTool(
    "update_resource",
    {
      description: "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0438\u043B\u0438 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u0435 \u0440\u0435\u0441\u0443\u0440\u0441\u0430.",
      inputSchema: {
        id: z5.string(),
        name: z5.string().min(1).max(200).optional(),
        contentMd: z5.string().optional()
      }
    },
    async ({ id, name, contentMd }) => {
      context.getLogger().info("mcp", "Tool update_resource called", { id });
      const resource = await context.getAppService().updateResource({ id, name, contentMd });
      return {
        content: textContent("\u0420\u0435\u0441\u0443\u0440\u0441 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D."),
        structuredContent: serializeResource(resource)
      };
    }
  );
  server.registerTool(
    "find_resources",
    {
      description: "\u041D\u0430\u0439\u0442\u0438 \u0433\u043B\u043E\u0431\u0430\u043B\u044C\u043D\u044B\u0435 \u0440\u0435\u0441\u0443\u0440\u0441\u044B \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E \u0438\u043B\u0438 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u043C\u0443.",
      inputSchema: {
        query: z5.string().min(1),
        limit: z5.number().int().min(1).max(20).optional()
      }
    },
    async ({ query, limit }) => {
      context.getLogger().debug("mcp", "Tool find_resources called", { query });
      const resources = await context.getAppService().listResources();
      const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
      const matches = resources.filter(
        (resource) => [resource.id, resource.name, resource.contentMd].join(" ").toLocaleLowerCase("ru-RU").includes(normalizedQuery)
      ).slice(0, limit ?? 5);
      const response = serializeResourceCollection(matches);
      return {
        content: textContent(JSON.stringify(response, null, 2)),
        structuredContent: response
      };
    }
  );
}

// src/main/mcp/actions/resource-template-actions.ts
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
function registerResourceTemplateActions(server, context) {
  server.registerResource(
    "task-resource",
    new ResourceTemplate("task://{id}", { list: void 0 }),
    {
      description: "JSON \u0437\u0430\u0434\u0430\u0447\u0438 \u0438\u0437 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430"
    },
    async (uri, variables) => {
      const taskContext = await context.requireTaskContext(String(variables.id));
      const task = await taskContext.getTask();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(serializeTask(task), null, 2)
          }
        ]
      };
    }
  );
  server.registerResource(
    "plan-resource",
    new ResourceTemplate("plan://{taskId}", { list: void 0 }),
    {
      description: "Markdown-\u043F\u043B\u0430\u043D \u0437\u0430\u0434\u0430\u0447\u0438 \u0438\u0437 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430"
    },
    async (uri, variables) => {
      const taskContext = await context.requireTaskContext(String(variables.taskId));
      const plan = await taskContext.getPlan();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: plan?.contentMd ?? ""
          }
        ]
      };
    }
  );
}

// src/main/mcp/actions/session-actions.ts
function registerSessionActions(server, context) {
  server.registerTool(
    "get_session_state",
    {
      description: "\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0442\u0435\u043A\u0443\u0449\u0435\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 MCP-\u0441\u0435\u0441\u0441\u0438\u0438: \u043D\u0430\u0434 \u043A\u0430\u043A\u043E\u0439 \u0437\u0430\u0434\u0430\u0447\u0435\u0439 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0430\u0433\u0435\u043D\u0442, \u043D\u0430\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0441\u0432\u0435\u0436 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u0438 \u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0448\u0430\u0433\u043E\u0432 \u0443\u0436\u0435 \u0441\u0434\u0435\u043B\u0430\u043D\u043E. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u043F\u0435\u0440\u0435\u0434 \u043D\u0430\u0447\u0430\u043B\u043E\u043C \u0440\u0430\u0431\u043E\u0442\u044B \u0441 \u0437\u0430\u0434\u0430\u0447\u0435\u0439, \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u043D\u044F\u0442\u044C, \u043D\u0443\u0436\u043D\u043E \u043B\u0438 \u043F\u0435\u0440\u0435\u0447\u0438\u0442\u044B\u0432\u0430\u0442\u044C \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442."
    },
    async () => {
      context.getLogger().debug("mcp", "Tool get_session_state called");
      const response = serializeAgentSession(context.getAgentSession());
      return {
        content: textContent(JSON.stringify(response, null, 2)),
        structuredContent: response
      };
    }
  );
}

// src/main/mcp/actions/task-actions.ts
import { z as z6 } from "zod";
function registerTaskActions(server, context) {
  server.registerTool(
    "create_task",
    {
      description: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u043E\u0432\u0443\u044E \u0437\u0430\u0434\u0430\u0447\u0443 \u0432 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u043C \u043F\u0440\u043E\u0435\u043A\u0442\u0435 \u0441 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u043D\u043E\u0439 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u043E\u0439.",
      inputSchema: {
        title: z6.string().min(3),
        description: z6.string().min(12)
      }
    },
    async ({ description, title }) => {
      const project = await context.requirePreparedProject();
      context.getLogger().info("mcp", "Tool create_task called", { projectId: project.id, title });
      const detail = await context.getAppService().createTask({ title, description, projectId: project.id });
      return {
        content: textContent("\u0417\u0430\u0434\u0430\u0447\u0430 \u0441\u043E\u0437\u0434\u0430\u043D\u0430."),
        structuredContent: serializeTaskDetail(detail)
      };
    }
  );
  server.registerTool(
    "list_tasks",
    {
      description: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0438 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0441 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u043D\u043E\u0439 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u043E\u0439."
    },
    async () => {
      const project = await context.requirePreparedProject();
      context.getLogger().debug("mcp", "Tool list_tasks called", { projectId: project.id });
      const tasks = await context.getAppService().listTasks(project.id);
      const response = serializeTaskCollection(tasks, project);
      return {
        content: textContent(JSON.stringify(response, null, 2)),
        structuredContent: response
      };
    }
  );
  server.registerTool(
    "find_tasks",
    {
      description: "\u041D\u0430\u0439\u0442\u0438 \u0437\u0430\u0434\u0430\u0447\u0438 \u0432\u043D\u0443\u0442\u0440\u0438 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0441 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u043D\u043E\u0439 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u043E\u0439 \u043F\u043E id, \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E, \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u044E \u0438\u043B\u0438 \u0441\u0442\u0430\u0442\u0443\u0441\u0443.",
      inputSchema: {
        query: z6.string().min(1),
        limit: z6.number().int().min(1).max(20).optional()
      }
    },
    async ({ limit, query }) => {
      const project = await context.requirePreparedProject();
      context.getLogger().debug("mcp", "Tool find_tasks called", {
        projectId: project.id,
        query,
        limit: limit ?? 5
      });
      const tasks = await context.getAppService().listTasks(project.id);
      const matches = findTasksByQuery(tasks, query, limit ?? 5);
      const response = serializeTaskCollection(matches, project);
      return {
        content: textContent(JSON.stringify(response, null, 2)),
        structuredContent: response
      };
    }
  );
  server.registerTool(
    "get_task",
    {
      description: "\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u043F\u043E\u043B\u043D\u0443\u044E \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044E \u043E \u0437\u0430\u0434\u0430\u0447\u0435 \u043F\u043E taskId: task, plan (\u0432\u043A\u043B\u044E\u0447\u0430\u044F contentMd \u0438 \u0432\u0441\u0435 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0438), linkedResources, linkedTasks.",
      inputSchema: {
        taskId: z6.string()
      }
    },
    async ({ taskId }) => {
      context.getLogger().debug("mcp", "Tool get_task called", { taskId });
      const taskContext = createTaskContext(taskId, context.getAppService());
      const snapshot = await taskContext.getSnapshot();
      const response = serializeTaskSnapshot(snapshot);
      return {
        content: textContent(JSON.stringify(response, null, 2)),
        structuredContent: response
      };
    }
  );
  server.registerTool(
    "sync_task",
    {
      description: "\u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0443 \u0441 \u0441\u0435\u0441\u0441\u0438\u0435\u0439. \u041F\u0435\u0440\u0432\u044B\u0439 \u0432\u044B\u0437\u043E\u0432 \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0442 \u043F\u043E\u043B\u043D\u044B\u0439 \u0441\u043D\u0430\u043F\u0448\u043E\u0442 \u0438 \u043F\u0435\u0440\u0435\u0432\u043E\u0434\u0438\u0442 \u0441\u0435\u0441\u0441\u0438\u044E \u0432 work-\u0440\u0435\u0436\u0438\u043C. \u041F\u043E\u0432\u0442\u043E\u0440\u043D\u044B\u0435 \u0432\u044B\u0437\u043E\u0432\u044B \u0432 \u0440\u0430\u043C\u043A\u0430\u0445 \u0442\u043E\u0439 \u0436\u0435 \u0441\u0435\u0441\u0441\u0438\u0438 \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u044E\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u0441 \u043C\u043E\u043C\u0435\u043D\u0442\u0430 \u043F\u0435\u0440\u0432\u043E\u0433\u043E \u0432\u044B\u0437\u043E\u0432\u0430 (delta-\u0440\u0435\u0436\u0438\u043C). \u0415\u0441\u043B\u0438 \u043F\u0440\u043E\u0435\u043A\u0442 \u0437\u0430\u0434\u0430\u0447\u0438 \u043D\u0435 \u0430\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u043D, \u0430\u043A\u0442\u0438\u0432\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438.",
      inputSchema: {
        taskId: z6.string()
      }
    },
    async ({ taskId }) => {
      const activeProjectId = context.getActiveProjectId();
      const detail = await context.getAppService().getTaskDetail(taskId);
      const taskProjectId = detail.task.projectId;
      if (activeProjectId !== taskProjectId) {
        context.setActiveProjectId(taskProjectId);
        context.resetSession();
        context.getLogger().info("mcp", "Tool sync_task auto-activated project", {
          taskId,
          previousProjectId: activeProjectId,
          projectId: taskProjectId
        });
      }
      const session = context.getAgentSession();
      context.getLogger().debug("mcp", "Tool sync_task called", {
        taskId,
        projectId: taskProjectId,
        mode: session.lastMode,
        sessionTaskId: session.taskId
      });
      const taskContext = await context.requireTaskContext(taskId);
      const isDelta = session.lastMode !== null && session.taskId === taskId && session.lastContextVersion !== null;
      if (isDelta) {
        const since = session.lastContextVersion;
        if (since === null) {
          throw new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u044B\u0447\u0438\u0441\u043B\u0438\u0442\u044C \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u0434\u043B\u044F delta-\u0440\u0435\u0436\u0438\u043C\u0430.");
        }
        const snapshot2 = await taskContext.getSnapshot();
        context.updateAgentSession(toDeltaMode(session));
        const response2 = serializeDeltaSnapshot(snapshot2, since);
        return {
          content: textContent(JSON.stringify(response2, null, 2)),
          structuredContent: response2
        };
      }
      const snapshot = await taskContext.getSnapshot();
      context.updateAgentSession(startWork(session, taskId));
      const response = serializeTaskSnapshot(snapshot);
      return {
        content: textContent(JSON.stringify(response, null, 2)),
        structuredContent: response
      };
    }
  );
  server.registerTool(
    "update_task_status",
    {
      description: "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0441\u0442\u0430\u0442\u0443\u0441 \u0437\u0430\u0434\u0430\u0447\u0438 \u0432\u043D\u0443\u0442\u0440\u0438 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430. \u0414\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0435 \u0441\u0442\u0430\u0442\u0443\u0441\u044B: new, planning, requires_clarification, implementation, testing, completed.",
      inputSchema: {
        taskId: z6.string(),
        status: z6.enum(["new", "planning", "requires_clarification", "implementation", "testing", "completed"])
      }
    },
    async ({ status, taskId }) => {
      const taskContext = await context.requireTaskContext(taskId);
      context.touchSession({ taskId });
      context.getLogger().info("mcp", "Tool update_task_status called", { taskId, status });
      await taskContext.updateStatus(status);
      const snapshot = await taskContext.getSnapshot();
      return {
        content: textContent("\u0421\u0442\u0430\u0442\u0443\u0441 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D."),
        structuredContent: serializeTaskSnapshot(snapshot)
      };
    }
  );
}

// src/main/mcp/controller/mcp-server-controller.ts
var McpServerController = class {
  constructor(server, appService, logger) {
    this.server = server;
    this.context = new McpControllerContext(appService, logger);
  }
  context;
  register() {
    registerProjectActions(this.server, this.context);
    registerTaskActions(this.server, this.context);
    registerPlanActions(this.server, this.context);
    registerResourceActions(this.server, this.context);
    registerSessionActions(this.server, this.context);
    registerPromptActions(this.server);
    registerResourceTemplateActions(this.server, this.context);
  }
};

// src/main/mcp/create-mcp-server.ts
function createMcpServer(appService, logger) {
  const server = new McpServer(
    {
      name: "aitasker-mcp",
      version: "1.0.0"
    },
    {
      capabilities: {
        logging: {}
      }
    }
  );
  const controller = new McpServerController(server, appService, logger);
  controller.register();
  return server;
}

// src/main/mcp/mcp-http-server.ts
var DEFAULT_MCP_PORT = 39291;
function resolveMcpPort() {
  const rawPort = process.env.AITASKER_MCP_PORT;
  if (!rawPort) {
    return DEFAULT_MCP_PORT;
  }
  const port = Number.parseInt(rawPort, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`AITASKER_MCP_PORT must be an integer between 1 and 65535. Received: ${rawPort}`);
  }
  return port;
}
async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text2 = Buffer.concat(chunks).toString("utf8");
  return text2 ? JSON.parse(text2) : void 0;
}
function writeJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}
function getSessionId(rawHeader) {
  return Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
}
var McpHttpServer = class {
  constructor(appService, logger) {
    this.appService = appService;
    this.logger = logger;
  }
  sessions = /* @__PURE__ */ new Map();
  httpServer = null;
  port = null;
  get endpoint() {
    return this.port ? `http://127.0.0.1:${this.port}/mcp` : null;
  }
  get isRunning() {
    return this.httpServer !== null && this.port !== null;
  }
  async start() {
    if (this.httpServer) {
      return;
    }
    const port = resolveMcpPort();
    this.httpServer = createServer(async (request, response) => {
      if (!request.url?.startsWith("/mcp")) {
        response.statusCode = 404;
        response.end("Not Found");
        return;
      }
      try {
        if (request.method === "POST") {
          const body = await readJsonBody(request);
          await this.handlePostRequest(request, response, body);
          return;
        }
        if (request.method === "GET" || request.method === "DELETE") {
          await this.handleSessionRequest(request, response);
          return;
        }
        response.statusCode = 405;
        response.end("Method Not Allowed");
      } catch (error) {
        this.logger.error("mcp", "HTTP request failed", {
          error: error instanceof Error ? error.message : String(error)
        });
        if (!response.headersSent) {
          writeJson(response, 500, {
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: "Internal server error"
            },
            id: null
          });
        }
      }
    });
    await new Promise((resolve, reject) => {
      this.httpServer?.once("error", reject);
      this.httpServer?.listen(port, "127.0.0.1", () => {
        const address = this.httpServer?.address();
        if (!address || typeof address === "string") {
          reject(new Error("Could not determine MCP server port."));
          return;
        }
        this.port = address.port;
        this.logger.info("mcp", "HTTP server started", { endpoint: this.endpoint });
        resolve();
      });
    });
  }
  async stop() {
    for (const session of this.sessions.values()) {
      await session.server.close();
      await session.transport.close();
    }
    this.sessions.clear();
    if (!this.httpServer) {
      return;
    }
    await new Promise((resolve, reject) => {
      this.httpServer?.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    this.httpServer = null;
    this.port = null;
  }
  async handlePostRequest(request, response, body) {
    const sessionId = getSessionId(request.headers["mcp-session-id"]);
    if (!sessionId && isInitializeRequest(body)) {
      const server = createMcpServer(this.appService, this.logger);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID10(),
        enableJsonResponse: true
      });
      transport.onclose = () => {
        if (transport.sessionId) {
          this.sessions.delete(transport.sessionId);
        }
      };
      await server.connect(transport);
      if (transport.sessionId) {
        this.sessions.set(transport.sessionId, { server, transport });
      }
      await transport.handleRequest(request, response, body);
      if (transport.sessionId) {
        this.sessions.set(transport.sessionId, { server, transport });
      }
      return;
    }
    await this.handleSessionRequest(request, response, body, sessionId);
  }
  async handleSessionRequest(request, response, body, sessionIdHeader) {
    const sessionId = sessionIdHeader ?? getSessionId(request.headers["mcp-session-id"]);
    if (!sessionId) {
      writeJson(response, 400, {
        jsonrpc: "2.0",
        error: {
          code: -32e3,
          message: "MCP session id is required."
        },
        id: null
      });
      return;
    }
    const session = this.sessions.get(sessionId);
    if (!session) {
      writeJson(response, 404, {
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: "Unknown MCP session."
        },
        id: null
      });
      return;
    }
    await session.transport.handleRequest(request, response, body);
  }
};

// src/main/assets/app-icon-paths.ts
import { existsSync } from "fs";
import { join as join2 } from "path";
function resolveIconPath(app, fileName) {
  const candidates = [
    join2(app.getAppPath(), "build", "icons", fileName),
    join2(process.cwd(), "build", "icons", fileName),
    join2(process.resourcesPath, "build", "icons", fileName),
    join2(process.resourcesPath, "app.asar.unpacked", "build", "icons", fileName)
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}
function getWindowIconPath(app) {
  return resolveIconPath(app, "icon.ico") ?? void 0;
}
function getTrayIconPath(app) {
  return resolveIconPath(app, "icon_tray.png") ?? getWindowIconPath(app);
}

// src/main/tray/app-tray.ts
import { Menu, nativeImage, Tray } from "electron";
function createAppTray(getWindow, app, quitApplication) {
  const trayIconPath = getTrayIconPath(app);
  const icon = trayIconPath ? nativeImage.createFromPath(trayIconPath) : nativeImage.createEmpty();
  if (icon.isEmpty()) {
    throw new Error("Tray icon could not be loaded from build/icons/icon_tray.png or build/icons/icon.ico.");
  }
  const tray = new Tray(icon);
  tray.setToolTip("AITasker");
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C AITasker",
      click() {
        const win = getWindow();
        if (!win) return;
        win.show();
        win.focus();
      }
    },
    { type: "separator" },
    {
      label: "\u0412\u044B\u0439\u0442\u0438",
      click() {
        void quitApplication();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    const win = getWindow();
    if (!win) return;
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
      win.focus();
    }
  });
  return tray;
}
function setupWindowHideOnClose(win, platform, app) {
  if (platform === "darwin") return;
  let isQuitting = false;
  app.on("before-quit", () => {
    isQuitting = true;
  });
  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
}

// src/main/index.ts
import { Menu as Menu2, nativeTheme } from "electron";
var CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
var APP_ROOT = join3(CURRENT_DIR, "..", "..");
var RENDERER_DIST = join3(APP_ROOT, "dist");
var PRELOAD_SCRIPT = join3(APP_ROOT, "preload.js");
var VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
var DATA_CHANGED_CHANNEL = "app:data-changed";
var FOCUS_TASK_CHANNEL = "app:focus-task";
var SET_WINDOW_THEME_CHANNEL = "app:set-window-theme";
var SET_WINDOW_TITLE_CONTEXT_CHANNEL = "app:set-window-title-context";
var NOTIFY_REASONS = /* @__PURE__ */ new Set([
  "update-task-status",
  "save-plan",
  "create-task",
  "append-plan-extension",
  "append-plan-improvement"
]);
var REASON_LABELS = {
  "update-task-status": "\u0421\u0442\u0430\u0442\u0443\u0441 \u0437\u0430\u0434\u0430\u0447\u0438 \u0438\u0437\u043C\u0435\u043D\u0451\u043D",
  "save-plan": "\u041F\u043B\u0430\u043D \u043E\u0431\u043D\u043E\u0432\u043B\u0451\u043D",
  "create-task": "\u0417\u0430\u0434\u0430\u0447\u0430 \u0441\u043E\u0437\u0434\u0430\u043D\u0430",
  "append-plan-extension": "\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435 \u043F\u043B\u0430\u043D\u0430",
  "append-plan-improvement": "\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0430 \u0434\u043E\u0440\u0430\u0431\u043E\u0442\u043A\u0430 \u043F\u043B\u0430\u043D\u0430"
};
async function sendTaskNotification(event, getWindow, getTaskDetail) {
  if (!NOTIFY_REASONS.has(event.reason)) return;
  const { Notification } = await import("electron");
  if (!Notification.isSupported()) return;
  const label = REASON_LABELS[event.reason] ?? event.reason;
  let taskLine = "";
  if (event.taskId) {
    try {
      const detail = await getTaskDetail(event.taskId);
      if (detail) {
        taskLine = `[${detail.project.name}] ${detail.task.title}
`;
      }
    } catch {
    }
  }
  const notification = new Notification({
    title: "AITasker",
    body: taskLine + label,
    silent: true
  });
  notification.on("click", () => {
    const win = getWindow();
    if (!win) return;
    win.show();
    win.focus();
    if (event.taskId) {
      win.webContents.send(FOCUS_TASK_CHANNEL, event.taskId);
    }
  });
  notification.show();
}
var mainWindow = null;
var currentWindowTheme = "light";
var currentWindowTitleContext = {
  projectName: null,
  taskTitle: null
};
function sanitizeTitlePart(value) {
  return value.replace(/\s+/g, " ").trim();
}
function buildMainWindowTitle(context) {
  const parts = ["AITasker"];
  const projectName = context.projectName ? sanitizeTitlePart(context.projectName) : "";
  const taskTitle = context.taskTitle ? sanitizeTitlePart(context.taskTitle) : "";
  if (projectName) {
    parts.push(projectName);
  }
  if (taskTitle) {
    parts.push(taskTitle);
  }
  return parts.join(" / ");
}
function applyMainWindowTitle() {
  mainWindow?.setTitle(buildMainWindowTitle(currentWindowTitleContext));
}
function applyMainWindowTheme() {
  if (process.platform !== "win32") {
    return;
  }
  nativeTheme.themeSource = currentWindowTheme;
}
async function createMainWindow(runtime) {
  const windowIconPath = getWindowIconPath(runtime.app);
  mainWindow = new runtime.BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    show: false,
    title: "AITasker",
    icon: windowIconPath,
    webPreferences: {
      preload: PRELOAD_SCRIPT,
      contextIsolation: true,
      sandbox: false
    }
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });
  applyMainWindowTitle();
  applyMainWindowTheme();
  if (VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }
  await mainWindow.loadFile(join3(RENDERER_DIST, "index.html"));
}
function bootstrapMainProcess(runtime) {
  if (process.platform === "win32") {
    runtime.app.setAppUserModelId("com.aitasker.app");
  }
  runtime.app.whenReady().then(async () => {
    Menu2.setApplicationMenu(null);
    const databaseContext = createAppDatabase(runtime.app.getPath("userData"));
    const logger = createDevLogger();
    const taskRepository = new TaskRepository(databaseContext.database);
    const taskLinkRepository = new TaskLinkRepository(databaseContext.database);
    const planRepository = new PlanRepository(databaseContext.database);
    const planCommentRepository = new PlanCommentRepository(databaseContext.database);
    const projectRepository = new ProjectRepository(databaseContext.database);
    const promptOverrideRepository = new PromptOverrideRepository(databaseContext.database);
    const agentSessionRepository = new AgentSessionRepository(databaseContext.database);
    const resourceRepository = new ResourceRepository(databaseContext.database);
    const taskResourceRepository = new TaskResourceRepository(databaseContext.database);
    const taskContextRepository = new TaskContextRepository(databaseContext.database);
    const agentRegistry = createAgentRegistry();
    let appService;
    let mcpHttpServer = null;
    let isShuttingDown = false;
    const shutdownApp = async () => {
      if (isShuttingDown) {
        return;
      }
      isShuttingDown = true;
      try {
        await mcpHttpServer?.stop();
      } catch (error) {
        logger.error("app", "Failed to stop MCP server during shutdown", {
          error: error instanceof Error ? error.message : String(error)
        });
      } finally {
        runtime.app.exit(0);
      }
    };
    appService = createAppService({
      agentProviders: agentRegistry.providers,
      agentSessionRepository,
      databasePath: databaseContext.databasePath,
      getMcpEndpoint: () => mcpHttpServer?.endpoint ?? null,
      isMcpRunning: () => mcpHttpServer?.isRunning ?? false,
      onDataChanged: (event) => {
        for (const window of runtime.BrowserWindow.getAllWindows()) {
          window.webContents.send(DATA_CHANGED_CHANNEL, event);
        }
        void sendTaskNotification(event, () => mainWindow, appService.getTaskDetail.bind(appService));
      },
      planCommentRepository,
      planRepository,
      platform: process.platform,
      projectRepository,
      promptOverrideRepository,
      relaunchApp: () => {
        runtime.app.relaunch();
        runtime.app.exit(0);
      },
      resourceRepository,
      sqlite: databaseContext.sqlite,
      taskLinkRepository,
      taskRepository,
      taskResourceRepository,
      taskContextRepository
    });
    mcpHttpServer = new McpHttpServer(appService, logger);
    await mcpHttpServer.start();
    logger.info("app", "Main process initialized", {
      databasePath: databaseContext.databasePath,
      mcpEndpoint: mcpHttpServer.endpoint
    });
    registerIpcHandlers(runtime.ipcMain, appService);
    runtime.ipcMain.handle(SET_WINDOW_THEME_CHANNEL, (_event, theme) => {
      currentWindowTheme = theme === "dark" ? "dark" : "light";
      applyMainWindowTheme();
    });
    runtime.ipcMain.handle(
      SET_WINDOW_TITLE_CONTEXT_CHANNEL,
      (_event, input) => {
        currentWindowTitleContext = {
          projectName: input.projectName,
          taskTitle: input.taskTitle
        };
        applyMainWindowTitle();
      }
    );
    await createMainWindow(runtime);
    createAppTray(() => mainWindow, runtime.app, shutdownApp);
    if (mainWindow) {
      setupWindowHideOnClose(mainWindow, process.platform, runtime.app);
    }
    runtime.app.on("activate", async () => {
      if (runtime.BrowserWindow.getAllWindows().length === 0) {
        await createMainWindow(runtime);
      }
    });
    runtime.app.on("before-quit", (event) => {
      if (isShuttingDown) {
        return;
      }
      event.preventDefault();
      void shutdownApp();
    });
  });
  runtime.app.on("window-all-closed", () => {
    if (process.platform === "darwin") {
      runtime.app.quit();
    }
  });
}
export {
  bootstrapMainProcess
};
//# sourceMappingURL=index.js.map