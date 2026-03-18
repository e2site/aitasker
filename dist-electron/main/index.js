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
var databaseSchema = {
  agentSessionsTable,
  planRevisionsTable,
  plansTable,
  projectsTable,
  promptOverridesTable,
  resourcesTable,
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

// src/main/db/plan-repository.ts
import { randomUUID as randomUUID2 } from "crypto";
import { desc, eq as eq2 } from "drizzle-orm";
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
  const revisionId = randomUUID2();
  database.insert(planRevisionsTable).values({
    id: revisionId,
    planId: plan.id,
    taskId: plan.taskId,
    contentMd: plan.contentMd,
    source: plan.source,
    createdAt: /* @__PURE__ */ new Date()
  }).run();
  const createdRevision = database.select().from(planRevisionsTable).where(eq2(planRevisionsTable.id, revisionId)).get();
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
    const row = this.database.select().from(plansTable).where(eq2(plansTable.taskId, taskId)).get();
    return row ? toPlanRecord(row) : null;
  }
  async getRevisionById(revisionId) {
    const row = this.database.select().from(planRevisionsTable).where(eq2(planRevisionsTable.id, revisionId)).get();
    return row ? toPlanRevisionRecord(row) : null;
  }
  async listRevisions(taskId) {
    const rows = this.database.select().from(planRevisionsTable).where(eq2(planRevisionsTable.taskId, taskId)).orderBy(desc(planRevisionsTable.createdAt)).all();
    return rows.map(toPlanRevisionRecord);
  }
  async restoreRevision(input) {
    const revision = await this.getRevisionById(input.revisionId);
    if (!revision || revision.taskId !== input.taskId) {
      throw new Error(`\u0420\u0435\u0432\u0438\u0437\u0438\u044F ${input.revisionId} \u0434\u043B\u044F \u0437\u0430\u0434\u0430\u0447\u0438 ${input.taskId} \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430.`);
    }
    const existing = this.database.select().from(plansTable).where(eq2(plansTable.taskId, input.taskId)).get();
    if (!existing) {
      throw new Error(`\u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u043F\u043B\u0430\u043D \u0437\u0430\u0434\u0430\u0447\u0438 ${input.taskId} \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D.`);
    }
    this.database.update(plansTable).set({
      contentMd: revision.contentMd,
      source: revision.source,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq2(plansTable.taskId, input.taskId)).run();
    const restored = await this.getByTaskId(input.taskId);
    if (!restored) {
      throw new Error("\u041F\u043B\u0430\u043D \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D, \u043D\u043E \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0435\u0440\u0435\u0447\u0438\u0442\u0430\u0442\u044C \u0435\u0433\u043E \u0438\u0437 \u0431\u0430\u0437\u044B.");
    }
    return restored;
  }
  async save(input) {
    const now = /* @__PURE__ */ new Date();
    const existing = this.database.select().from(plansTable).where(eq2(plansTable.taskId, input.taskId)).get();
    if (existing) {
      const hasChanges = existing.contentMd !== input.contentMd || existing.source !== input.source;
      if (hasChanges && input.createRevision) {
        await insertRevision(this.database, existing);
      }
      this.database.update(plansTable).set({
        contentMd: input.contentMd,
        source: input.source,
        updatedAt: now
      }).where(eq2(plansTable.taskId, input.taskId)).run();
    } else {
      this.database.insert(plansTable).values({
        id: randomUUID2(),
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
import { randomUUID as randomUUID3 } from "crypto";
import { desc as desc2, eq as eq3 } from "drizzle-orm";
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
    const id = randomUUID3();
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
    const row = this.database.select().from(projectsTable).where(eq3(projectsTable.normalizedName, normalizeProjectName(name))).get();
    return row ? toProjectRecord(row) : null;
  }
  async getById(projectId) {
    const row = this.database.select().from(projectsTable).where(eq3(projectsTable.id, projectId)).get();
    return row ? toProjectRecord(row) : null;
  }
  async list() {
    const rows = this.database.select().from(projectsTable).orderBy(desc2(projectsTable.updatedAt), desc2(projectsTable.createdAt)).all();
    return rows.map(toProjectRecord);
  }
  async touch(projectId) {
    this.database.update(projectsTable).set({
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq3(projectsTable.id, projectId)).run();
  }
  async updateProfile(input) {
    const existing = this.database.select().from(projectsTable).where(eq3(projectsTable.id, input.projectId)).get();
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
    }).where(eq3(projectsTable.id, input.projectId)).run();
    const updated = await this.getById(input.projectId);
    if (!updated) {
      throw new Error(`\u041F\u0440\u043E\u0435\u043A\u0442 ${input.projectId} \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D, \u043D\u043E \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0435\u0440\u0435\u0447\u0438\u0442\u0430\u0442\u044C \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443.`);
    }
    return updated;
  }
};

// src/main/db/prompt-override-repository.ts
import { eq as eq4 } from "drizzle-orm";
var PromptOverrideRepository = class {
  constructor(db) {
    this.db = db;
  }
  upsert(id, template) {
    const now = Date.now();
    const existing = this.db.select().from(promptOverridesTable).where(eq4(promptOverridesTable.id, id)).all();
    if (existing.length > 0) {
      this.db.update(promptOverridesTable).set({ template, updatedAt: new Date(now) }).where(eq4(promptOverridesTable.id, id)).run();
    } else {
      this.db.insert(promptOverridesTable).values({ id, template, createdAt: new Date(now), updatedAt: new Date(now) }).run();
    }
    return this.toRecord(id, template, existing[0]?.createdAt ?? new Date(now), new Date(now));
  }
  getById(id) {
    const rows = this.db.select().from(promptOverridesTable).where(eq4(promptOverridesTable.id, id)).all();
    if (rows.length === 0) return null;
    const row = rows[0];
    return this.toRecord(row.id, row.template, row.createdAt, row.updatedAt);
  }
  list() {
    return this.db.select().from(promptOverridesTable).all().map((row) => this.toRecord(row.id, row.template, row.createdAt, row.updatedAt));
  }
  delete(id) {
    const result = this.db.delete(promptOverridesTable).where(eq4(promptOverridesTable.id, id)).run();
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
import { randomUUID as randomUUID4 } from "crypto";
import { desc as desc3, eq as eq5 } from "drizzle-orm";
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
    const id = randomUUID4();
    const now = /* @__PURE__ */ new Date();
    this.database.insert(resourcesTable).values({
      id,
      name: input.name,
      contentMd: input.contentMd ?? "",
      createdAt: now,
      updatedAt: now
    }).run();
    const row = this.database.select().from(resourcesTable).where(eq5(resourcesTable.id, id)).get();
    if (!row) {
      throw new Error(`Resource ${id} not found after create.`);
    }
    return mapRow(row);
  }
  async getById(id) {
    const row = this.database.select().from(resourcesTable).where(eq5(resourcesTable.id, id)).get();
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
    }).where(eq5(resourcesTable.id, id)).run();
    const row = this.database.select().from(resourcesTable).where(eq5(resourcesTable.id, id)).get();
    if (!row) {
      throw new Error(`Resource ${id} not found.`);
    }
    return mapRow(row);
  }
  async delete(id) {
    this.database.delete(resourcesTable).where(eq5(resourcesTable.id, id)).run();
  }
};

// src/main/db/task-link-repository.ts
import { randomUUID as randomUUID5 } from "crypto";
import { eq as eq6, or } from "drizzle-orm";
var TaskLinkRepository = class {
  constructor(database) {
    this.database = database;
  }
  async create(input) {
    const id = randomUUID5();
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
        eq6(taskLinksTable.targetTaskId, tasksTable.id),
        eq6(taskLinksTable.sourceTaskId, tasksTable.id)
      )
    ).innerJoin(projectsTable, eq6(tasksTable.projectId, projectsTable.id)).where(or(eq6(taskLinksTable.sourceTaskId, taskId), eq6(taskLinksTable.targetTaskId, taskId))).all();
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
    const result = this.database.delete(taskLinksTable).where(eq6(taskLinksTable.id, linkId)).run();
    return result.changes > 0;
  }
};

// src/main/db/task-repository.ts
import { randomUUID as randomUUID6 } from "crypto";
import { and, desc as desc4, eq as eq7 } from "drizzle-orm";
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
    const id = randomUUID6();
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
    }).from(tasksTable).innerJoin(projectsTable, eq7(tasksTable.projectId, projectsTable.id)).leftJoin(plansTable, eq7(plansTable.taskId, tasksTable.id)).where(
      projectId ? and(eq7(tasksTable.id, taskId), eq7(tasksTable.projectId, projectId)) : eq7(tasksTable.id, taskId)
    ).get();
    return row ? toTaskRecord(row) : null;
  }
  async delete(taskId) {
    const result = this.database.delete(tasksTable).where(eq7(tasksTable.id, taskId)).run();
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
    }).from(tasksTable).innerJoin(projectsTable, eq7(tasksTable.projectId, projectsTable.id)).leftJoin(plansTable, eq7(plansTable.taskId, tasksTable.id)).where(projectId ? eq7(tasksTable.projectId, projectId) : void 0).orderBy(desc4(tasksTable.updatedAt)).all();
    return rows.map(toTaskRecord);
  }
  async touch(taskId) {
    this.database.update(tasksTable).set({
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq7(tasksTable.id, taskId)).run();
  }
  async update(taskId, fields) {
    this.database.update(tasksTable).set({ ...fields, updatedAt: /* @__PURE__ */ new Date() }).where(eq7(tasksTable.id, taskId)).run();
  }
  async updateStatus(taskId, status) {
    this.database.update(tasksTable).set({
      status,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq7(tasksTable.id, taskId)).run();
  }
};

// src/main/db/task-resource-repository.ts
import { randomUUID as randomUUID7 } from "crypto";
import { eq as eq8 } from "drizzle-orm";
var TaskResourceRepository = class {
  constructor(database) {
    this.database = database;
  }
  async link(input) {
    const id = randomUUID7();
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
    }).from(taskResourcesTable).innerJoin(resourcesTable, eq8(taskResourcesTable.resourceId, resourcesTable.id)).where(eq8(taskResourcesTable.id, id)).get();
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
    }).from(taskResourcesTable).innerJoin(resourcesTable, eq8(taskResourcesTable.resourceId, resourcesTable.id)).where(eq8(taskResourcesTable.taskId, taskId)).all();
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
    const result = this.database.delete(taskResourcesTable).where(eq8(taskResourcesTable.id, linkId)).run();
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
  source: planSourceSchema.default("human")
});
var appendPlanExtensionInputSchema = z.object({
  taskId: z.string(),
  content: z.string().trim().min(1).max(4e3),
  author: planDiscussionAuthorSchema.default("human")
});
var appendPlanImprovementInputSchema = z.object({
  taskId: z.string(),
  content: z.string().trim().min(1).max(4e3),
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
    "append-plan-extension",
    "append-plan-improvement",
    "answer-plan-question",
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
function formatHiddenSection(config, values) {
  if (values.length === 0) {
    return "";
  }
  return `<!-- ${config.startMarker}
${JSON.stringify(values, null, 2)}
${config.endMarker} -->`;
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
function composeManagedPlanContent(baseContentMd, extensions, improvements, discussion, questions) {
  const parts = [
    normalizeMarkdown(baseContentMd),
    formatHiddenSection(hiddenSectionConfigByKind.extension, extensions),
    formatHiddenSection(hiddenSectionConfigByKind.improvement, improvements),
    formatHiddenSection(hiddenSectionConfigByKind.discussion, discussion),
    formatHiddenSection({ endMarker: QUESTIONS_MARKER_END, startMarker: QUESTIONS_MARKER_START, title: QUESTIONS_TITLE }, questions)
  ].filter(Boolean);
  return parts.join("\n\n").trim();
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
function appendManagedPlanBlock(contentMd, kind, value, author) {
  const parsed = parseManagedPlanContent(contentMd);
  const normalizedValue = normalizeMarkdown(value);
  if (!normalizedValue) {
    return composeManagedPlanContent(
      parsed.baseContentMd,
      parsed.extensions,
      parsed.improvements,
      parsed.discussion,
      parsed.questions
    );
  }
  const nextComment = formatManagedPlanComment({
    author,
    content: normalizedValue,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  return composeManagedPlanContent(
    parsed.baseContentMd,
    kind === "extension" ? [...parsed.extensions, nextComment] : parsed.extensions,
    kind === "improvement" ? [...parsed.improvements, nextComment] : parsed.improvements,
    kind === "discussion" ? [...parsed.discussion, nextComment] : parsed.discussion,
    parsed.questions
  );
}
function replaceBasePlanContent(contentMd, nextBaseContentMd) {
  const parsed = parseManagedPlanContent(contentMd);
  return composeManagedPlanContent(
    nextBaseContentMd,
    parsed.extensions,
    parsed.improvements,
    parsed.discussion,
    parsed.questions
  );
}
function replaceManagedPlanQuestions(contentMd, nextQuestions) {
  const parsed = parseManagedPlanContent(contentMd);
  const questions = nextQuestions.map(
    (question) => formatManagedPlanQuestion({
      content: question,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    })
  ).filter((question) => Boolean(question.content));
  return composeManagedPlanContent(
    parsed.baseContentMd,
    parsed.extensions,
    parsed.improvements,
    parsed.discussion,
    questions
  );
}
function answerManagedPlanQuestion(contentMd, questionId, answer) {
  const parsed = parseManagedPlanContent(contentMd);
  const question = parsed.questions.find((item) => item.id === questionId);
  const normalizedAnswer = normalizeMarkdown(answer);
  if (!question || !normalizedAnswer) {
    return composeManagedPlanContent(
      parsed.baseContentMd,
      parsed.extensions,
      parsed.improvements,
      parsed.discussion,
      parsed.questions
    );
  }
  return composeManagedPlanContent(
    parsed.baseContentMd,
    parsed.extensions,
    parsed.improvements,
    [
      ...parsed.discussion,
      formatManagedPlanComment({
        author: "agent",
        content: `**\u0412\u043E\u043F\u0440\u043E\u0441:** ${question.content}`,
        createdAt: question.createdAt
      }),
      formatManagedPlanComment({
        author: "human",
        content: `**\u041E\u0442\u0432\u0435\u0442:** ${normalizedAnswer}`,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      })
    ],
    parsed.questions.filter((item) => item.id !== questionId)
  );
}
function consolidateManagedPlanDiscussion(contentMd, nextBaseContentMd, nextQuestions) {
  const parsed = parseManagedPlanContent(contentMd);
  const questions = nextQuestions === void 0 ? parsed.questions : nextQuestions.map(
    (question) => formatManagedPlanQuestion({
      content: question,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    })
  ).filter((question) => Boolean(question.content));
  return composeManagedPlanContent(nextBaseContentMd, [], [], [], questions);
}
function extractBasePlanContent(contentMd) {
  const parsed = parseManagedPlanContent(contentMd);
  return stripRenderedDiscussionSections(parsed.baseContentMd);
}
function findManagedPlanComment(contentMd, kind, commentId) {
  const parsed = parseManagedPlanContent(contentMd);
  const comments = kind === "extension" ? parsed.extensions : kind === "improvement" ? parsed.improvements : parsed.discussion;
  return comments.find((comment) => comment.id === commentId) ?? null;
}

// src/main/services/app-service.ts
function createAppService(dependencies) {
  const emitDataChanged = (event) => {
    dependencies.onDataChanged?.(event);
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
    const [plan, planRevisions, agentSession, linkedTasks, linkedResources] = await Promise.all([
      dependencies.planRepository.getByTaskId(taskId),
      dependencies.planRepository.listRevisions(taskId),
      dependencies.agentSessionRepository.getByTaskId(taskId),
      dependencies.taskLinkRepository.listByTaskId(taskId),
      dependencies.taskResourceRepository.listByTaskId(taskId)
    ]);
    return {
      project,
      task,
      plan,
      planRevisions,
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
    async answerPlanQuestion(input) {
      const parsedInput = answerPlanQuestionInputSchema.parse(input);
      const detail = await getTaskDetail(parsedInput.taskId);
      if (!detail.plan) {
        throw new Error("\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0441\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u0438\u043B\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0431\u0430\u0437\u043E\u0432\u044B\u0439 \u043F\u043B\u0430\u043D, \u0437\u0430\u0442\u0435\u043C \u043E\u0442\u0432\u0435\u0447\u0430\u0439\u0442\u0435 \u043D\u0430 \u0432\u043E\u043F\u0440\u043E\u0441\u044B.");
      }
      await dependencies.planRepository.save({
        taskId: parsedInput.taskId,
        contentMd: answerManagedPlanQuestion(detail.plan.contentMd, parsedInput.questionId, parsedInput.answer),
        source: detail.plan.source
      });
      await dependencies.taskRepository.touch(parsedInput.taskId);
      await dependencies.projectRepository.touch(detail.task.projectId);
      emitDataChanged({
        reason: "answer-plan-question",
        projectId: detail.task.projectId,
        taskId: parsedInput.taskId
      });
      return getTaskDetail(parsedInput.taskId);
    },
    async appendPlanExtension(input) {
      const parsedInput = appendPlanExtensionInputSchema.parse(input);
      const detail = await getTaskDetail(parsedInput.taskId);
      if (!detail.plan) {
        throw new Error("\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0441\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u0438\u043B\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0431\u0430\u0437\u043E\u0432\u044B\u0439 \u043F\u043B\u0430\u043D, \u0437\u0430\u0442\u0435\u043C \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0439\u0442\u0435 \u0435\u0433\u043E \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u044F.");
      }
      await dependencies.planRepository.save({
        taskId: parsedInput.taskId,
        contentMd: appendManagedPlanBlock(
          detail.plan.contentMd,
          "extension",
          parsedInput.content,
          parsedInput.author
        ),
        source: detail.plan.source
      });
      await dependencies.taskRepository.touch(parsedInput.taskId);
      await dependencies.projectRepository.touch(detail.task.projectId);
      emitDataChanged({
        reason: "append-plan-extension",
        projectId: detail.task.projectId,
        taskId: parsedInput.taskId
      });
      return getTaskDetail(parsedInput.taskId);
    },
    async appendPlanImprovement(input) {
      const parsedInput = appendPlanImprovementInputSchema.parse(input);
      const detail = await getTaskDetail(parsedInput.taskId);
      if (!detail.plan) {
        throw new Error("\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0441\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u0438\u043B\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0431\u0430\u0437\u043E\u0432\u044B\u0439 \u043F\u043B\u0430\u043D, \u0437\u0430\u0442\u0435\u043C \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0439\u0442\u0435 \u0435\u0433\u043E \u0434\u043E\u0440\u0430\u0431\u043E\u0442\u043A\u0438.");
      }
      await dependencies.planRepository.save({
        taskId: parsedInput.taskId,
        contentMd: appendManagedPlanBlock(
          detail.plan.contentMd,
          "improvement",
          parsedInput.content,
          parsedInput.author
        ),
        source: detail.plan.source
      });
      await dependencies.taskRepository.touch(parsedInput.taskId);
      await dependencies.projectRepository.touch(detail.task.projectId);
      emitDataChanged({
        reason: "append-plan-improvement",
        projectId: detail.task.projectId,
        taskId: parsedInput.taskId
      });
      return getTaskDetail(parsedInput.taskId);
    },
    async consolidatePlanDiscussion(input) {
      const parsedInput = consolidatePlanDiscussionInputSchema.parse(input);
      const detail = await getTaskDetail(parsedInput.taskId);
      const currentPlanContent = detail.plan?.contentMd ?? "";
      const nextBaseContentMd = extractBasePlanContent(parsedInput.contentMd);
      const finalContentMd = consolidateManagedPlanDiscussion(
        currentPlanContent,
        nextBaseContentMd,
        parsedInput.openQuestions
      );
      await dependencies.planRepository.save({
        taskId: parsedInput.taskId,
        contentMd: finalContentMd,
        createRevision: parsedInput.source === "agent",
        source: parsedInput.source
      });
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
      const currentPlanContent = detail.plan?.contentMd ?? "";
      const nextBaseContentMd = extractBasePlanContent(parsedInput.contentMd);
      const nextContentMd = replaceBasePlanContent(
        currentPlanContent,
        nextBaseContentMd
      );
      const finalContentMd = parsedInput.openQuestions === void 0 ? nextContentMd : replaceManagedPlanQuestions(nextContentMd, parsedInput.openQuestions);
      await dependencies.planRepository.save({
        ...parsedInput,
        contentMd: finalContentMd,
        createRevision: parsedInput.source === "agent"
      });
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
import { randomUUID as randomUUID8 } from "crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

// src/main/mcp/create-mcp-server.ts
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z as z2 } from "zod";
function textContent(text2) {
  return [{ type: "text", text: text2 }];
}
function ensureStructuredPlan(plan, taskId) {
  if (!plan) {
    return { taskId, exists: false, contentMd: "" };
  }
  return {
    ...plan,
    contentMd: parseManagedPlanContent(plan.contentMd).renderedContentMd
  };
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
  let activeProjectId = null;
  const requireActiveProject = async () => {
    if (!activeProjectId) {
      throw new Error("\u041F\u0440\u043E\u0435\u043A\u0442 \u043D\u0435 \u0430\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u043D. \u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u044B\u0437\u043E\u0432\u0438\u0442\u0435 activate_project.");
    }
    const project = await appService.getProject(activeProjectId);
    if (!project) {
      activeProjectId = null;
      throw new Error("\u0410\u043A\u0442\u0438\u0432\u043D\u044B\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442. \u0410\u043A\u0442\u0438\u0432\u0438\u0440\u0443\u0439\u0442\u0435 \u043F\u0440\u043E\u0435\u043A\u0442 \u0437\u0430\u043D\u043E\u0432\u043E.");
    }
    return project;
  };
  const requirePreparedProject = async () => {
    const project = await requireActiveProject();
    if (!project.isProfileComplete) {
      throw new Error(getProjectProfileHint(project));
    }
    return project;
  };
  const getScopedTaskDetail = async (taskId) => {
    const project = await requirePreparedProject();
    const detail = await appService.getTaskDetail(taskId, project.id);
    return { detail, project };
  };
  server.registerTool(
    "create_project",
    {
      description: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u043E\u0432\u044B\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u0434\u043B\u044F \u0434\u0430\u043B\u044C\u043D\u0435\u0439\u0448\u0435\u0439 \u0440\u0430\u0431\u043E\u0442\u044B \u0441 \u0437\u0430\u0434\u0430\u0447\u0430\u043C\u0438.",
      inputSchema: {
        name: z2.string().min(2).max(80)
      }
    },
    async ({ name }) => {
      logger.info("mcp", "Tool create_project called", { name });
      const project = await appService.createProject({ name });
      return {
        content: textContent(`\u041F\u0440\u043E\u0435\u043A\u0442 ${project.name} \u0433\u043E\u0442\u043E\u0432. ${getProjectProfileHint(project)}`),
        structuredContent: project
      };
    }
  );
  server.registerTool(
    "list_projects",
    {
      description: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0441\u043F\u0438\u0441\u043E\u043A \u0432\u0441\u0435\u0445 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432, \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0445 \u0432 AITasker."
    },
    async () => {
      logger.debug("mcp", "Tool list_projects called");
      const projects = await appService.listProjects();
      return {
        content: textContent(JSON.stringify(projects, null, 2)),
        structuredContent: { projects, activeProjectId }
      };
    }
  );
  server.registerTool(
    "find_projects",
    {
      description: "\u041D\u0430\u0439\u0442\u0438 \u043F\u0440\u043E\u0435\u043A\u0442 \u043F\u043E id, \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E, \u043F\u0443\u0442\u0438 \u0438\u043B\u0438 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u044E \u043F\u0435\u0440\u0435\u0434 \u0430\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u0435\u0439.",
      inputSchema: {
        query: z2.string().min(1),
        limit: z2.number().int().min(1).max(20).optional()
      }
    },
    async ({ limit, query }) => {
      logger.debug("mcp", "Tool find_projects called", { query, limit: limit ?? 5 });
      const projects = await appService.listProjects();
      const matches = findProjectsByQuery(projects, query, limit ?? 5);
      return {
        content: textContent(JSON.stringify(matches, null, 2)),
        structuredContent: { projects: matches, activeProjectId }
      };
    }
  );
  server.registerTool(
    "activate_project",
    {
      description: "\u0410\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442 \u0432 \u0442\u0435\u043A\u0443\u0449\u0435\u0439 MCP-\u0441\u0435\u0441\u0441\u0438\u0438. \u041F\u043E\u0441\u043B\u0435 \u0430\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u0438 \u0430\u0433\u0435\u043D\u0442 \u0434\u043E\u043B\u0436\u0435\u043D \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0438 \u0437\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443 \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0447\u0435\u0440\u0435\u0437 update_project_profile.",
      inputSchema: {
        projectRef: z2.string().min(1)
      }
    },
    async ({ projectRef }) => {
      logger.info("mcp", "Tool activate_project called", { projectRef });
      const projects = await appService.listProjects();
      const resolved = resolveProjectReference(projects, projectRef);
      if (!resolved.project && resolved.matches.length > 1) {
        throw new Error(
          `\u041D\u0430\u0439\u0434\u0435\u043D\u043E \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432 \u043F\u043E \u0437\u0430\u043F\u0440\u043E\u0441\u0443 "${projectRef}". \u0423\u0442\u043E\u0447\u043D\u0438\u0442\u0435 \u043F\u0440\u043E\u0435\u043A\u0442 \u0447\u0435\u0440\u0435\u0437 id \u0438\u043B\u0438 \u0442\u043E\u0447\u043D\u043E\u0435 \u0438\u043C\u044F.`
        );
      }
      if (!resolved.project) {
        throw new Error(`\u041F\u0440\u043E\u0435\u043A\u0442 "${projectRef}" \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D.`);
      }
      activeProjectId = resolved.project.id;
      return {
        content: textContent(`\u0410\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u043D \u043F\u0440\u043E\u0435\u043A\u0442 ${resolved.project.name}. ${getProjectProfileHint(resolved.project)}`),
        structuredContent: resolved.project
      };
    }
  );
  server.registerTool(
    "get_active_project",
    {
      description: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u0442\u0435\u043A\u0443\u0449\u0435\u0439 MCP-\u0441\u0435\u0441\u0441\u0438\u0438 \u0432\u043C\u0435\u0441\u0442\u0435 \u0441 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u043E\u0439 \u043F\u0440\u043E\u0444\u0438\u043B\u044F."
    },
    async () => {
      logger.debug("mcp", "Tool get_active_project called");
      const project = await requireActiveProject();
      return {
        content: textContent(JSON.stringify(project, null, 2)),
        structuredContent: project
      };
    }
  );
  server.registerTool(
    "update_project_profile",
    {
      description: "\u0417\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u0438\u043B\u0438 \u0443\u0442\u043E\u0447\u043D\u0438\u0442\u044C \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430: \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435, \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435, \u043F\u0443\u0442\u044C, \u044F\u0437\u044B\u043A\u0438 \u0438 \u043F\u0443\u0442\u044C \u043A SKILL.md.",
      inputSchema: {
        name: z2.string().min(2).max(80).optional(),
        description: z2.string().max(4e3).optional(),
        rootPath: z2.string().min(1).max(500).nullable().optional(),
        languages: z2.array(z2.string().min(1).max(40)).max(20).optional(),
        skillFilePath: z2.string().min(1).max(500).nullable().optional(),
        skillPrompt: z2.string().max(4e3).optional()
      }
    },
    async (input) => {
      const project = await requireActiveProject();
      logger.info("mcp", "Tool update_project_profile called", { projectId: project.id });
      const updated = await appService.updateProjectProfile({
        projectId: project.id,
        ...input
      });
      return {
        content: textContent(`\u041A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u043F\u0440\u043E\u0435\u043A\u0442\u0430 ${updated.name} \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0430.`),
        structuredContent: updated
      };
    }
  );
  server.registerTool(
    "create_task",
    {
      description: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u043E\u0432\u0443\u044E \u0437\u0430\u0434\u0430\u0447\u0443 \u0432 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u043C \u043F\u0440\u043E\u0435\u043A\u0442\u0435 \u0441 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u043D\u043E\u0439 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u043E\u0439.",
      inputSchema: {
        title: z2.string().min(3),
        description: z2.string().min(12)
      }
    },
    async ({ description, title }) => {
      const project = await requirePreparedProject();
      logger.info("mcp", "Tool create_task called", { projectId: project.id, title });
      const detail = await appService.createTask({ title, description, projectId: project.id });
      return {
        content: textContent(`\u0417\u0430\u0434\u0430\u0447\u0430 ${detail.task.id} \u0441\u043E\u0437\u0434\u0430\u043D\u0430 \u0432 \u043F\u0440\u043E\u0435\u043A\u0442\u0435 ${project.name} \u0441\u043E \u0441\u0442\u0430\u0442\u0443\u0441\u043E\u043C new.`),
        structuredContent: detail
      };
    }
  );
  server.registerTool(
    "list_tasks",
    {
      description: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0438 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0441 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u043D\u043E\u0439 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u043E\u0439."
    },
    async () => {
      const project = await requirePreparedProject();
      logger.debug("mcp", "Tool list_tasks called", { projectId: project.id });
      const tasks = await appService.listTasks(project.id);
      return {
        content: textContent(JSON.stringify(tasks, null, 2)),
        structuredContent: { project, tasks }
      };
    }
  );
  server.registerTool(
    "find_tasks",
    {
      description: "\u041D\u0430\u0439\u0442\u0438 \u0437\u0430\u0434\u0430\u0447\u0438 \u0432\u043D\u0443\u0442\u0440\u0438 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0441 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u043D\u043E\u0439 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u043E\u0439 \u043F\u043E id, \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E, \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u044E \u0438\u043B\u0438 \u0441\u0442\u0430\u0442\u0443\u0441\u0443.",
      inputSchema: {
        query: z2.string().min(1),
        limit: z2.number().int().min(1).max(20).optional()
      }
    },
    async ({ limit, query }) => {
      const project = await requirePreparedProject();
      logger.debug("mcp", "Tool find_tasks called", {
        projectId: project.id,
        query,
        limit: limit ?? 5
      });
      const tasks = await appService.listTasks(project.id);
      const matches = findTasksByQuery(tasks, query, limit ?? 5);
      return {
        content: textContent(JSON.stringify(matches, null, 2)),
        structuredContent: { project, tasks: matches }
      };
    }
  );
  server.registerTool(
    "get_task",
    {
      description: "\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0443 \u0438 \u0435\u0435 \u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u043F\u043B\u0430\u043D \u043F\u043E taskId \u0431\u0435\u0437 \u0430\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u0438 \u043F\u0440\u043E\u0435\u043A\u0442\u0430.",
      inputSchema: {
        taskId: z2.string()
      }
    },
    async ({ taskId }) => {
      logger.debug("mcp", "Tool get_task called", { taskId });
      const detail = await appService.getTaskDetail(taskId);
      return {
        content: textContent(JSON.stringify(detail, null, 2)),
        structuredContent: detail
      };
    }
  );
  server.registerTool(
    "update_task_status",
    {
      description: "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0441\u0442\u0430\u0442\u0443\u0441 \u0437\u0430\u0434\u0430\u0447\u0438 \u0432\u043D\u0443\u0442\u0440\u0438 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430. \u0414\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0435 \u0441\u0442\u0430\u0442\u0443\u0441\u044B: new, planning, requires_clarification, implementation, testing, completed.",
      inputSchema: {
        taskId: z2.string(),
        status: z2.enum(["new", "planning", "requires_clarification", "implementation", "testing", "completed"])
      }
    },
    async ({ status, taskId }) => {
      await getScopedTaskDetail(taskId);
      logger.info("mcp", "Tool update_task_status called", { taskId, status });
      const detail = await appService.updateTaskStatus({ taskId, status });
      return {
        content: textContent(`\u0421\u0442\u0430\u0442\u0443\u0441 \u0437\u0430\u0434\u0430\u0447\u0438 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D \u043D\u0430 ${status}.`),
        structuredContent: detail
      };
    }
  );
  server.registerTool(
    "get_plan",
    {
      description: "\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0442\u0435\u043A\u0443\u0449\u0438\u0439 Markdown-\u043F\u043B\u0430\u043D \u0437\u0430\u0434\u0430\u0447\u0438 \u0432\u043C\u0435\u0441\u0442\u0435 \u0441 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u044F\u043C\u0438 \u0438 \u0434\u043E\u0440\u0430\u0431\u043E\u0442\u043A\u0430\u043C\u0438 \u0432\u043D\u0443\u0442\u0440\u0438 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430.",
      inputSchema: {
        taskId: z2.string()
      }
    },
    async ({ taskId }) => {
      logger.debug("mcp", "Tool get_plan called", { taskId });
      const { detail } = await getScopedTaskDetail(taskId);
      return {
        content: textContent(detail.plan ? parseManagedPlanContent(detail.plan.contentMd).renderedContentMd : ""),
        structuredContent: ensureStructuredPlan(detail.plan, taskId)
      };
    }
  );
  server.registerTool(
    "get_plan_extension",
    {
      description: "\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u043E\u0434\u043D\u043E \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u043E\u0435 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435 \u043F\u043B\u0430\u043D\u0430 \u043F\u043E extensionId \u0431\u0435\u0437 \u0447\u0442\u0435\u043D\u0438\u044F \u0432\u0441\u0435\u0433\u043E \u043F\u043B\u0430\u043D\u0430.",
      inputSchema: {
        taskId: z2.string(),
        extensionId: z2.string().min(1)
      }
    },
    async ({ extensionId, taskId }) => {
      logger.debug("mcp", "Tool get_plan_extension called", { taskId, extensionId });
      const { detail } = await getScopedTaskDetail(taskId);
      if (!detail.plan) {
        throw new Error(`\u041F\u043B\u0430\u043D \u0437\u0430\u0434\u0430\u0447\u0438 ${taskId} \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D.`);
      }
      const extension = findManagedPlanComment(detail.plan.contentMd, "extension", extensionId);
      if (!extension) {
        throw new Error(`\u0420\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435 ${extensionId} \u0434\u043B\u044F \u0437\u0430\u0434\u0430\u0447\u0438 ${taskId} \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E.`);
      }
      return {
        content: textContent(extension.content),
        structuredContent: {
          extension,
          taskId
        }
      };
    }
  );
  server.registerTool(
    "get_plan_improvement",
    {
      description: "\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u043E\u0434\u043D\u0443 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u0443\u044E \u0434\u043E\u0440\u0430\u0431\u043E\u0442\u043A\u0443 \u043F\u043B\u0430\u043D\u0430 \u043F\u043E improvementId \u0431\u0435\u0437 \u0447\u0442\u0435\u043D\u0438\u044F \u0432\u0441\u0435\u0433\u043E \u043F\u043B\u0430\u043D\u0430.",
      inputSchema: {
        taskId: z2.string(),
        improvementId: z2.string().min(1)
      }
    },
    async ({ improvementId, taskId }) => {
      logger.debug("mcp", "Tool get_plan_improvement called", { taskId, improvementId });
      const { detail } = await getScopedTaskDetail(taskId);
      if (!detail.plan) {
        throw new Error(`\u041F\u043B\u0430\u043D \u0437\u0430\u0434\u0430\u0447\u0438 ${taskId} \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D.`);
      }
      const improvement = findManagedPlanComment(detail.plan.contentMd, "improvement", improvementId);
      if (!improvement) {
        throw new Error(`\u0414\u043E\u0440\u0430\u0431\u043E\u0442\u043A\u0430 ${improvementId} \u0434\u043B\u044F \u0437\u0430\u0434\u0430\u0447\u0438 ${taskId} \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430.`);
      }
      return {
        content: textContent(improvement.content),
        structuredContent: {
          improvement,
          taskId
        }
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
        source: z2.enum(["human", "agent"]).optional()
      }
    },
    async ({ contentMd, openQuestions, source, taskId }) => {
      await getScopedTaskDetail(taskId);
      logger.info("mcp", "Tool save_plan called", {
        taskId,
        openQuestionsCount: openQuestions?.length ?? 0,
        source: source ?? "agent"
      });
      const detail = await appService.savePlan({
        taskId,
        contentMd,
        openQuestions,
        source: source ?? "agent"
      });
      return {
        content: textContent("\u041F\u043B\u0430\u043D \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D."),
        structuredContent: ensureStructuredPlan(detail.plan, taskId)
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
      await getScopedTaskDetail(taskId);
      logger.info("mcp", "Tool append_plan_extension called", { taskId });
      const detail = await appService.appendPlanExtension({ taskId, content, author: "agent" });
      return {
        content: textContent("\u0420\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435 \u043F\u043B\u0430\u043D\u0430 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E."),
        structuredContent: ensureStructuredPlan(detail.plan, taskId)
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
      await getScopedTaskDetail(taskId);
      logger.info("mcp", "Tool append_plan_improvement called", { taskId });
      const detail = await appService.appendPlanImprovement({ taskId, content, author: "agent" });
      return {
        content: textContent("\u0414\u043E\u0440\u0430\u0431\u043E\u0442\u043A\u0430 \u043F\u043B\u0430\u043D\u0430 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0430."),
        structuredContent: ensureStructuredPlan(detail.plan, taskId)
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
        openQuestions: z2.array(z2.string().min(1)).optional(),
        source: z2.enum(["human", "agent"]).optional()
      }
    },
    async ({ contentMd, openQuestions, source, taskId }) => {
      await getScopedTaskDetail(taskId);
      logger.info("mcp", "Tool consolidate_plan_discussion called", {
        taskId,
        openQuestionsCount: openQuestions?.length ?? 0,
        source: source ?? "agent"
      });
      const detail = await appService.consolidatePlanDiscussion({
        taskId,
        contentMd,
        openQuestions,
        source: source ?? "agent"
      });
      return {
        content: textContent("\u041F\u0435\u0440\u0435\u043F\u0438\u0441\u043A\u0430 \u043F\u043E \u043F\u043B\u0430\u043D\u0443 \u0441\u0436\u0430\u0442\u0430 \u0432 \u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u043F\u043B\u0430\u043D \u0438 \u043E\u0447\u0438\u0449\u0435\u043D\u0430 \u0438\u0437 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0445 \u0431\u043B\u043E\u043A\u043E\u0432."),
        structuredContent: ensureStructuredPlan(detail.plan, taskId)
      };
    }
  );
  server.registerTool(
    "create_resource",
    {
      description: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u043E\u0432\u044B\u0439 \u0433\u043B\u043E\u0431\u0430\u043B\u044C\u043D\u044B\u0439 \u0440\u0435\u0441\u0443\u0440\u0441 (Markdown-\u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442) \u043D\u0435 \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u043D\u043D\u044B\u0439 \u043A \u043F\u0440\u043E\u0435\u043A\u0442\u0443.",
      inputSchema: {
        name: z2.string().min(1).max(200),
        contentMd: z2.string().optional()
      }
    },
    async ({ name, contentMd }) => {
      logger.info("mcp", "Tool create_resource called", { name });
      const resource = await appService.createResource({ name, contentMd });
      return {
        content: textContent(`\u0420\u0435\u0441\u0443\u0440\u0441 "${resource.name}" \u0441\u043E\u0437\u0434\u0430\u043D \u0441 id ${resource.id}.`),
        structuredContent: resource
      };
    }
  );
  server.registerTool(
    "get_resource",
    {
      description: "\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0440\u0435\u0441\u0443\u0440\u0441 \u043F\u043E id.",
      inputSchema: {
        id: z2.string()
      }
    },
    async ({ id }) => {
      logger.debug("mcp", "Tool get_resource called", { id });
      const resource = await appService.getResource(id);
      return {
        content: textContent(JSON.stringify(resource, null, 2)),
        structuredContent: resource
      };
    }
  );
  server.registerTool(
    "list_resources",
    {
      description: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0441\u043F\u0438\u0441\u043E\u043A \u0432\u0441\u0435\u0445 \u0433\u043B\u043E\u0431\u0430\u043B\u044C\u043D\u044B\u0445 \u0440\u0435\u0441\u0443\u0440\u0441\u043E\u0432."
    },
    async () => {
      logger.debug("mcp", "Tool list_resources called");
      const resources = await appService.listResources();
      return {
        content: textContent(JSON.stringify(resources, null, 2)),
        structuredContent: { resources }
      };
    }
  );
  server.registerTool(
    "update_resource",
    {
      description: "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0438\u043B\u0438 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u0435 \u0440\u0435\u0441\u0443\u0440\u0441\u0430.",
      inputSchema: {
        id: z2.string(),
        name: z2.string().min(1).max(200).optional(),
        contentMd: z2.string().optional()
      }
    },
    async ({ id, name, contentMd }) => {
      logger.info("mcp", "Tool update_resource called", { id });
      const resource = await appService.updateResource({ id, name, contentMd });
      return {
        content: textContent(`\u0420\u0435\u0441\u0443\u0440\u0441 "${resource.name}" \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D.`),
        structuredContent: resource
      };
    }
  );
  server.registerTool(
    "find_resources",
    {
      description: "\u041D\u0430\u0439\u0442\u0438 \u0433\u043B\u043E\u0431\u0430\u043B\u044C\u043D\u044B\u0435 \u0440\u0435\u0441\u0443\u0440\u0441\u044B \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E \u0438\u043B\u0438 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u043C\u0443.",
      inputSchema: {
        query: z2.string().min(1),
        limit: z2.number().int().min(1).max(20).optional()
      }
    },
    async ({ query, limit }) => {
      logger.debug("mcp", "Tool find_resources called", { query });
      const resources = await appService.listResources();
      const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
      const matches = resources.filter(
        (r) => [r.id, r.name, r.contentMd].join(" ").toLocaleLowerCase("ru-RU").includes(normalizedQuery)
      ).slice(0, limit ?? 5);
      return {
        content: textContent(JSON.stringify(matches, null, 2)),
        structuredContent: { resources: matches }
      };
    }
  );
  server.registerPrompt(
    "plan_task",
    {
      description: "\u041F\u0440\u043E\u0432\u0435\u0441\u0442\u0438 planning \u0437\u0430\u0434\u0430\u0447\u0438 \u0438\u0437 AITasker \u0432\u043D\u0443\u0442\u0440\u0438 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C Markdown-\u043F\u043B\u0430\u043D \u043E\u0431\u0440\u0430\u0442\u043D\u043E.",
      argsSchema: {
        projectRef: z2.string().min(1).describe("Id \u0438\u043B\u0438 \u0447\u0438\u0442\u0430\u0435\u043C\u043E\u0435 \u0438\u043C\u044F \u043F\u0440\u043E\u0435\u043A\u0442\u0430, \u0432\u043D\u0443\u0442\u0440\u0438 \u043A\u043E\u0442\u043E\u0440\u043E\u0433\u043E \u043D\u0443\u0436\u043D\u043E \u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C."),
        taskRef: z2.string().min(1).describe("Id \u0437\u0430\u0434\u0430\u0447\u0438 \u0438\u043B\u0438 \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u043E\u0447\u0438\u0442\u0430\u0435\u043C\u043E\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0437\u0430\u0434\u0430\u0447\u0438 \u0438\u0437 \u0437\u0430\u043F\u0440\u043E\u0441\u0430 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F."),
        instructions: z2.string().optional().describe("\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u044F \u0438\u043B\u0438 \u043F\u043E\u0436\u0435\u043B\u0430\u043D\u0438\u044F \u043A \u043F\u043B\u0430\u043D\u0443.")
      }
    },
    async ({ instructions, projectRef, taskRef }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `\u0422\u044B \u043F\u043B\u0430\u043D\u0438\u0440\u0443\u0435\u0448\u044C \u0437\u0430\u0434\u0430\u0447\u0443, \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043D\u0443\u044E \u0432 AITasker.

\u041F\u0440\u043E\u0435\u043A\u0442 \u0438\u0437 \u0437\u0430\u043F\u0440\u043E\u0441\u0430 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: ${projectRef}
\u0421\u0441\u044B\u043B\u043A\u0430 \u043D\u0430 \u0437\u0430\u0434\u0430\u0447\u0443 \u0438\u0437 \u0437\u0430\u043F\u0440\u043E\u0441\u0430 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: ${taskRef}
\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u0438\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0438: ${instructions?.trim() || "none"}

\u041E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 workflow:
1. \u0420\u0430\u0437\u0440\u0435\u0448\u0438 \u043F\u0440\u043E\u0435\u043A\u0442 \u0438 \u0430\u043A\u0442\u0438\u0432\u0438\u0440\u0443\u0439 \u0435\u0433\u043E.
\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u044B\u0437\u043E\u0432\u0438 activate_project \u0441 projectRef.
\u0415\u0441\u043B\u0438 \u043F\u0440\u043E\u0435\u043A\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D, \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 find_projects.
\u0415\u0441\u043B\u0438 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0439 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E, \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0441\u044C \u0438 \u043F\u043E\u043F\u0440\u043E\u0441\u0438 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F \u0443\u0442\u043E\u0447\u043D\u0438\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442.

2. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443 \u043F\u0440\u043E\u0435\u043A\u0442\u0430.
\u0421\u0440\u0430\u0437\u0443 \u043F\u043E\u0441\u043B\u0435 \u0430\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u0438 \u0432\u044B\u0437\u043E\u0432\u0438 get_active_project.
\u0415\u0441\u043B\u0438 description, rootPath \u0438\u043B\u0438 languages \u043F\u0443\u0441\u0442\u044B\u0435, \u0437\u0430\u043F\u043E\u043B\u043D\u0438 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443 \u0447\u0435\u0440\u0435\u0437 update_project_profile.
\u041F\u044B\u0442\u0430\u0439\u0441\u044F \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C:
- \u0442\u043E\u0447\u043D\u043E\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043F\u0440\u043E\u0435\u043A\u0442\u0430
- \u043A\u0440\u0430\u0442\u043A\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435
- \u043F\u0443\u0442\u044C \u043A \u0440\u0430\u0431\u043E\u0447\u0435\u0439 \u0434\u0438\u0440\u0435\u043A\u0442\u043E\u0440\u0438\u0438
- \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u043C\u044B\u0435 \u044F\u0437\u044B\u043A\u0438

3. \u0420\u0430\u0437\u0440\u0435\u0448\u0438 \u0437\u0430\u0434\u0430\u0447\u0443 \u0432\u043D\u0443\u0442\u0440\u0438 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430.
\u0415\u0441\u043B\u0438 taskRef \u043D\u0435 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0442\u043E\u0447\u043D\u044B\u043C task id, \u0432\u044B\u0437\u043E\u0432\u0438 find_tasks.
\u0415\u0441\u043B\u0438 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0439 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E, \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0441\u044C \u0438 \u043F\u043E\u043F\u0440\u043E\u0441\u0438 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F \u0443\u0442\u043E\u0447\u043D\u0438\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0443.

4. \u041F\u0435\u0440\u0435\u0432\u0435\u0434\u0438 \u0437\u0430\u0434\u0430\u0447\u0443 \u0432 \u0441\u0442\u0430\u0442\u0443\u0441 planning.
\u041F\u043E\u0441\u043B\u0435 \u0442\u043E\u0433\u043E \u043A\u0430\u043A \u0437\u0430\u0434\u0430\u0447\u0430 \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043D\u0430, \u0432\u044B\u0437\u043E\u0432\u0438 update_task_status \u0441 status="planning".

5. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u0437\u0430\u0434\u0430\u0447\u0438.
\u0412\u044B\u0437\u043E\u0432\u0438 get_task \u0441 \u0442\u043E\u0447\u043D\u044B\u043C task id.
\u0415\u0441\u043B\u0438 \u0443 \u0437\u0430\u0434\u0430\u0447\u0438 \u0443\u0436\u0435 \u0435\u0441\u0442\u044C \u043F\u043B\u0430\u043D, \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u044F \u0438\u043B\u0438 \u0434\u043E\u0440\u0430\u0431\u043E\u0442\u043A\u0438, \u0442\u0430\u043A\u0436\u0435 \u0432\u044B\u0437\u043E\u0432\u0438 get_plan.

6. \u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u044C Markdown \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435:

# \u041F\u043B\u0430\u043D \u0437\u0430\u0434\u0430\u0447\u0438

## \u0426\u0435\u043B\u044C
...

## \u041A\u043E\u043D\u0442\u0435\u043A\u0441\u0442
...

## \u0428\u0430\u0433\u0438
1. ...
2. ...
3. ...

## \u041A\u0440\u0438\u0442\u0435\u0440\u0438\u0438 \u0433\u043E\u0442\u043E\u0432\u043D\u043E\u0441\u0442\u0438
- ...

7. \u0415\u0441\u043B\u0438 \u0435\u0441\u0442\u044C \u043D\u0435\u0437\u0430\u043A\u0440\u044B\u0442\u044B\u0435 \u0432\u043E\u043F\u0440\u043E\u0441\u044B, \u0441\u043E\u0431\u0435\u0440\u0438 \u0438\u0445 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u0441\u043F\u0438\u0441\u043A\u043E\u043C \u0441\u0442\u0440\u043E\u043A. \u041D\u0435 \u0437\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u0439 \u0438\u0445 \u0432 markdown-\u043F\u043B\u0430\u043D.

8. \u0421\u043E\u0445\u0440\u0430\u043D\u0438 \u0438\u0442\u043E\u0433\u043E\u0432\u044B\u0439 Markdown \u0447\u0435\u0440\u0435\u0437 save_plan \u0441 source="agent". \u0415\u0441\u043B\u0438 \u0435\u0441\u0442\u044C \u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0435 \u0432\u043E\u043F\u0440\u043E\u0441\u044B, \u043F\u0435\u0440\u0435\u0434\u0430\u0439 \u0438\u0445 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u043F\u043E\u043B\u0435\u043C openQuestions.

9. \u041F\u043E\u0441\u043B\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043F\u0435\u0440\u0435\u0432\u0435\u0434\u0438 \u0437\u0430\u0434\u0430\u0447\u0443 \u0432 \u0441\u0442\u0430\u0442\u0443\u0441 testing \u0447\u0435\u0440\u0435\u0437 update_task_status.

10. \u041F\u043E\u0441\u043B\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043E\u0442\u0432\u0435\u0442\u044C \u043A\u0440\u0430\u0442\u043A\u043E:
- \u043A\u0430\u043A\u043E\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u0431\u044B\u043B \u0430\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u043D
- \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0431\u044B\u043B\u0430 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u0430 \u0438\u043B\u0438 \u0443\u0436\u0435 \u0431\u044B\u043B\u0430 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u0430
- \u043A\u0430\u043A\u0430\u044F \u0437\u0430\u0434\u0430\u0447\u0430 \u0431\u044B\u043B\u0430 \u0440\u0430\u0441\u043F\u043B\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0430
- \u043A\u0430\u043A\u043E\u0439 \u0441\u0442\u0430\u0442\u0443\u0441 \u0431\u044B\u043B \u0432\u044B\u0441\u0442\u0430\u0432\u043B\u0435\u043D \u043F\u043E\u0441\u043B\u0435 \u043F\u043B\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F
- \u043F\u043B\u0430\u043D \u0431\u044B\u043B \u0441\u043E\u0437\u0434\u0430\u043D \u0438\u043B\u0438 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D
- \u0431\u044B\u043B\u0438 \u043B\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B \u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0435 \u0432\u043E\u043F\u0440\u043E\u0441\u044B \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E
- \u043A\u043E\u0440\u043E\u0442\u043A\u0430\u044F \u0441\u0432\u043E\u0434\u043A\u0430 \u043F\u043B\u0430\u043D\u0430

\u041D\u0435 \u043E\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0439\u0441\u044F \u043F\u043E\u0441\u043B\u0435 \u0430\u043D\u0430\u043B\u0438\u0437\u0430. \u0421\u043E\u0445\u0440\u0430\u043D\u0438 Markdown \u043E\u0431\u0440\u0430\u0442\u043D\u043E \u0432 AITasker \u0434\u043E \u0444\u0438\u043D\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u043E\u0442\u0432\u0435\u0442\u0430.`
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
        projectRef: z2.string().min(1).describe("Id \u0438\u043B\u0438 \u0447\u0438\u0442\u0430\u0435\u043C\u043E\u0435 \u0438\u043C\u044F \u043F\u0440\u043E\u0435\u043A\u0442\u0430, \u0432\u043D\u0443\u0442\u0440\u0438 \u043A\u043E\u0442\u043E\u0440\u043E\u0433\u043E \u043D\u0443\u0436\u043D\u043E \u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C."),
        taskRef: z2.string().min(1).describe("Id \u0437\u0430\u0434\u0430\u0447\u0438 \u0438\u043B\u0438 \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u043E\u0447\u0438\u0442\u0430\u0435\u043C\u043E\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0437\u0430\u0434\u0430\u0447\u0438 \u0438\u0437 \u0437\u0430\u043F\u0440\u043E\u0441\u0430 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F."),
        instructions: z2.string().optional().describe("\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u044F \u043A \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u043C\u0443 \u043F\u043B\u0430\u043D\u0443 \u043F\u043E\u0441\u043B\u0435 \u0441\u0436\u0430\u0442\u0438\u044F \u043F\u0435\u0440\u0435\u043F\u0438\u0441\u043A\u0438.")
      }
    },
    async ({ instructions, projectRef, taskRef }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `\u0422\u044B \u0441\u0436\u0438\u043C\u0430\u0435\u0448\u044C \u043F\u0435\u0440\u0435\u043F\u0438\u0441\u043A\u0443 \u043F\u043E \u0437\u0430\u0434\u0430\u0447\u0435, \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043D\u043E\u0439 \u0432 AITasker, \u043E\u0431\u0440\u0430\u0442\u043D\u043E \u0432 \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u043F\u043B\u0430\u043D.

\u041F\u0440\u043E\u0435\u043A\u0442 \u0438\u0437 \u0437\u0430\u043F\u0440\u043E\u0441\u0430 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: ${projectRef}
\u0421\u0441\u044B\u043B\u043A\u0430 \u043D\u0430 \u0437\u0430\u0434\u0430\u0447\u0443 \u0438\u0437 \u0437\u0430\u043F\u0440\u043E\u0441\u0430 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: ${taskRef}
\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u0438\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0438: ${instructions?.trim() || "none"}

\u041E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 workflow:
1. \u0410\u043A\u0442\u0438\u0432\u0438\u0440\u0443\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u0447\u0435\u0440\u0435\u0437 activate_project. \u0415\u0441\u043B\u0438 \u043F\u0440\u043E\u0435\u043A\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D, \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 find_projects.
2. \u0421\u0440\u0430\u0437\u0443 \u0432\u044B\u0437\u043E\u0432\u0438 get_active_project \u0438 \u0443\u0431\u0435\u0434\u0438\u0441\u044C, \u0447\u0442\u043E \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u0430.
3. \u0420\u0430\u0437\u0440\u0435\u0448\u0438 \u0437\u0430\u0434\u0430\u0447\u0443 \u0432\u043D\u0443\u0442\u0440\u0438 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430. \u0415\u0441\u043B\u0438 taskRef \u043D\u0435 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0442\u043E\u0447\u043D\u044B\u043C task id, \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 find_tasks.
4. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439 \u0437\u0430\u0434\u0430\u0447\u0443 \u0447\u0435\u0440\u0435\u0437 get_task, \u0437\u0430\u0442\u0435\u043C \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E \u0432\u044B\u0437\u043E\u0432\u0438 get_plan.
5. \u041D\u0430 \u043E\u0441\u043D\u043E\u0432\u0435 \u0442\u0435\u043A\u0443\u0449\u0435\u0433\u043E \u043F\u043B\u0430\u043D\u0430, \u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0445 \u0432\u043E\u043F\u0440\u043E\u0441\u043E\u0432 \u0438 \u043F\u0435\u0440\u0435\u043F\u0438\u0441\u043A\u0438 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u044C \u043D\u043E\u0432\u044B\u0439 \u0446\u0435\u043B\u044C\u043D\u044B\u0439 Markdown-\u043F\u043B\u0430\u043D \u0431\u0435\u0437 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0445 discussion-\u0431\u043B\u043E\u043A\u043E\u0432.
6. \u0415\u0441\u043B\u0438 \u043F\u043E\u0441\u043B\u0435 \u0441\u0436\u0430\u0442\u0438\u044F \u043E\u0441\u0442\u0430\u044E\u0442\u0441\u044F \u043D\u0435\u0437\u0430\u043A\u0440\u044B\u0442\u044B\u0435 \u0432\u043E\u043F\u0440\u043E\u0441\u044B, \u0441\u043E\u0431\u0435\u0440\u0438 \u0438\u0445 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u0441\u043F\u0438\u0441\u043A\u043E\u043C \u0441\u0442\u0440\u043E\u043A. \u041D\u0435 \u0437\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u0439 \u0438\u0445 \u0432 markdown-\u043F\u043B\u0430\u043D.
7. \u0421\u043E\u0445\u0440\u0430\u043D\u0438 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0439 \u043F\u043B\u0430\u043D \u0447\u0435\u0440\u0435\u0437 consolidate_plan_discussion \u0441 source="agent". \u0415\u0441\u043B\u0438 \u043E\u0441\u0442\u0430\u044E\u0442\u0441\u044F \u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0435 \u0432\u043E\u043F\u0440\u043E\u0441\u044B, \u043F\u0435\u0440\u0435\u0434\u0430\u0439 \u0438\u0445 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u043F\u043E\u043B\u0435\u043C openQuestions.
8. \u041F\u043E\u0441\u043B\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043E\u0442\u0432\u0435\u0442\u044C \u043A\u0440\u0430\u0442\u043A\u043E:
- \u043A\u0430\u043A\u043E\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u0431\u044B\u043B \u0430\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u043D
- \u043A\u0430\u043A\u0430\u044F \u0437\u0430\u0434\u0430\u0447\u0430 \u0431\u044B\u043B\u0430 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0430
- \u043A\u0430\u043A\u0438\u0435 \u043A\u043B\u044E\u0447\u0435\u0432\u044B\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u043F\u043E\u043F\u0430\u043B\u0438 \u0432 \u043D\u043E\u0432\u044B\u0439 \u043F\u043B\u0430\u043D
- \u043E\u0441\u0442\u0430\u043B\u0438\u0441\u044C \u043B\u0438 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0435 \u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0435 \u0432\u043E\u043F\u0440\u043E\u0441\u044B \u043F\u043E\u0441\u043B\u0435 \u0441\u0436\u0430\u0442\u0438\u044F
- \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435, \u0447\u0442\u043E \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u044F \u0438 \u0434\u043E\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u0431\u044B\u043B\u0438 \u043E\u0447\u0438\u0449\u0435\u043D\u044B \u0438\u0437 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0445 \u0431\u043B\u043E\u043A\u043E\u0432

\u041D\u0435 \u043E\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0439\u0441\u044F \u043D\u0430 \u0430\u043D\u0430\u043B\u0438\u0437\u0435. \u041E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E \u0432\u044B\u0437\u043E\u0432\u0438 consolidate_plan_discussion \u0434\u043E \u0444\u0438\u043D\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u043E\u0442\u0432\u0435\u0442\u0430.`
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
        projectRef: z2.string().min(1).describe("Id \u0438\u043B\u0438 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043F\u0440\u043E\u0435\u043A\u0442\u0430, \u0434\u043B\u044F \u043A\u043E\u0442\u043E\u0440\u043E\u0433\u043E \u043D\u0443\u0436\u043D\u043E \u0441\u043E\u0437\u0434\u0430\u0442\u044C skill."),
        skillPath: z2.string().optional().describe("\u041D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u043F\u0443\u0442\u044C \u043A SKILL.md. \u0415\u0441\u043B\u0438 \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D, \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 skillFilePath \u0438\u0437 \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0438\u043B\u0438 <rootPath>/SKILL.md."),
        instructions: z2.string().optional().describe("\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F \u043A \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u043C\u0443 skill-\u0444\u0430\u0439\u043B\u0430.")
      }
    },
    async ({ instructions, projectRef, skillPath }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `\u0422\u044B \u043F\u043E\u0434\u0433\u043E\u0442\u0430\u0432\u043B\u0438\u0432\u0430\u0435\u0448\u044C SKILL.md \u0434\u043B\u044F \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0432 AITasker.

\u041F\u0440\u043E\u0435\u043A\u0442 \u0438\u0437 \u0437\u0430\u043F\u0440\u043E\u0441\u0430 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: ${projectRef}
\u041F\u0443\u0442\u044C \u043A skill-\u0444\u0430\u0439\u043B\u0443 \u0438\u0437 \u0437\u0430\u043F\u0440\u043E\u0441\u0430: ${skillPath?.trim() || "not provided"}
\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u0438\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0438: ${instructions?.trim() || "none"}

\u041E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 workflow:
1. \u0410\u043A\u0442\u0438\u0432\u0438\u0440\u0443\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u0447\u0435\u0440\u0435\u0437 activate_project.
\u0415\u0441\u043B\u0438 \u043F\u0440\u043E\u0435\u043A\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D, \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 find_projects.

2. \u0421\u0440\u0430\u0437\u0443 \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0439 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443 \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0447\u0435\u0440\u0435\u0437 get_active_project.
\u0415\u0441\u043B\u0438 description, rootPath \u0438\u043B\u0438 languages \u043F\u0443\u0441\u0442\u044B\u0435, \u0441\u043D\u0430\u0447\u0430\u043B\u0430 \u0437\u0430\u043F\u043E\u043B\u043D\u0438 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443 \u0447\u0435\u0440\u0435\u0437 update_project_profile.

3. \u041E\u043F\u0440\u0435\u0434\u0435\u043B\u0438 \u043F\u0443\u0442\u044C \u043A skill-\u0444\u0430\u0439\u043B\u0443.
\u041F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442:
- \u043F\u0443\u0442\u044C \u0438\u0437 skillPath
- skillFilePath \u0438\u0437 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u043F\u0440\u043E\u0435\u043A\u0442\u0430
- <rootPath>/SKILL.md
\u0415\u0441\u043B\u0438 rootPath \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0438 \u043F\u0443\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u043D\u0430\u0434\u0435\u0436\u043D\u043E, \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0441\u044C \u0438 \u043F\u043E\u043F\u0440\u043E\u0441\u0438 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F \u0443\u043A\u0430\u0437\u0430\u0442\u044C \u043F\u0443\u0442\u044C.

4. \u0421\u043E\u0437\u0434\u0430\u0439 \u0438\u043B\u0438 \u043E\u0431\u043D\u043E\u0432\u0438 SKILL.md \u043D\u0430 \u0434\u0438\u0441\u043A\u0435 \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0441\u0432\u043E\u0438\u043C\u0438 \u0444\u0430\u0439\u043B\u043E\u0432\u044B\u043C\u0438 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0430\u043C\u0438.
\u0424\u0430\u0439\u043B \u0434\u043E\u043B\u0436\u0435\u043D \u043F\u043E\u043C\u043E\u0433\u0430\u0442\u044C \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0442\u044C \u0442\u0438\u043F\u043E\u0432\u044B\u0435 \u0437\u0430\u0434\u0430\u0447\u0438 \u043F\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0443: workflow, \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u044F, \u0441\u043E\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u044F \u043F\u043E \u043A\u043E\u0434\u0443, \u0432\u0430\u0436\u043D\u044B\u0435 \u043A\u043E\u043C\u0430\u043D\u0434\u044B, \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430 \u0438 \u043F\u0440\u0430\u0432\u0438\u043B\u0430.

5. \u041F\u043E\u0441\u043B\u0435 \u0437\u0430\u043F\u0438\u0441\u0438 \u0444\u0430\u0439\u043B\u0430 \u0432\u044B\u0437\u043E\u0432\u0438 update_project_profile \u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0438:
- skillFilePath
- \u043F\u0440\u0438 \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E\u0441\u0442\u0438 skillPrompt
- \u0443\u0442\u043E\u0447\u043D\u0435\u043D\u043D\u044B\u0435 description/rootPath/languages, \u0435\u0441\u043B\u0438 \u0432 \u0445\u043E\u0434\u0435 \u0430\u043D\u0430\u043B\u0438\u0437\u0430 \u043D\u0430\u0448\u043B\u0438\u0441\u044C \u0431\u043E\u043B\u0435\u0435 \u0442\u043E\u0447\u043D\u044B\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F

6. \u041E\u0442\u0432\u0435\u0442\u044C \u043A\u0440\u0430\u0442\u043A\u043E:
- \u043A\u0430\u043A\u043E\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u0430\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u043D
- \u0433\u0434\u0435 \u0441\u043E\u0437\u0434\u0430\u043D \u0438\u043B\u0438 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D SKILL.md
- \u0447\u0442\u043E \u0438\u043C\u0435\u043D\u043D\u043E \u043E\u043F\u0438\u0441\u0430\u043D\u043E \u0432 skill-\u0444\u0430\u0439\u043B\u0435

\u041D\u0435 \u043E\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0439\u0441\u044F \u043D\u0430 \u043F\u043B\u0430\u043D\u0435. \u0415\u0441\u043B\u0438 \u0443 \u0442\u0435\u0431\u044F \u0435\u0441\u0442\u044C \u0434\u043E\u0441\u0442\u0443\u043F \u043A \u0444\u0430\u0439\u043B\u043E\u0432\u044B\u043C \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0430\u043C, \u0441\u043E\u0437\u0434\u0430\u0439 \u0438\u043B\u0438 \u043E\u0431\u043D\u043E\u0432\u0438 SKILL.md \u043F\u0435\u0440\u0435\u0434 \u0444\u0438\u043D\u0430\u043B\u044C\u043D\u044B\u043C \u043E\u0442\u0432\u0435\u0442\u043E\u043C.`
          }
        }
      ]
    })
  );
  server.registerResource(
    "task-resource",
    new ResourceTemplate("task://{id}", { list: void 0 }),
    {
      description: "JSON \u0437\u0430\u0434\u0430\u0447\u0438 \u0438\u0437 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430"
    },
    async (uri, variables) => {
      const { detail } = await getScopedTaskDetail(String(variables.id));
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(detail.task, null, 2)
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
      const { detail } = await getScopedTaskDetail(String(variables.taskId));
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: detail.plan ? parseManagedPlanContent(detail.plan.contentMd).renderedContentMd : ""
          }
        ]
      };
    }
  );
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
        sessionIdGenerator: () => randomUUID8(),
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
import { Menu as Menu2 } from "electron";
var CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
var APP_ROOT = join3(CURRENT_DIR, "..", "..");
var RENDERER_DIST = join3(APP_ROOT, "dist");
var PRELOAD_SCRIPT = join3(APP_ROOT, "preload.js");
var VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
var DATA_CHANGED_CHANNEL = "app:data-changed";
var FOCUS_TASK_CHANNEL = "app:focus-task";
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
    const projectRepository = new ProjectRepository(databaseContext.database);
    const promptOverrideRepository = new PromptOverrideRepository(databaseContext.database);
    const agentSessionRepository = new AgentSessionRepository(databaseContext.database);
    const resourceRepository = new ResourceRepository(databaseContext.database);
    const taskResourceRepository = new TaskResourceRepository(databaseContext.database);
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
      taskResourceRepository
    });
    mcpHttpServer = new McpHttpServer(appService, logger);
    await mcpHttpServer.start();
    logger.info("app", "Main process initialized", {
      databasePath: databaseContext.databasePath,
      mcpEndpoint: mcpHttpServer.endpoint
    });
    registerIpcHandlers(runtime.ipcMain, appService);
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