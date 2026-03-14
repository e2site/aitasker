// src/main/index.ts
import { dirname, join as join2 } from "path";
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
var databaseSchema = {
  agentSessionsTable,
  plansTable,
  projectsTable,
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
import { eq as eq2 } from "drizzle-orm";
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
var PlanRepository = class {
  constructor(database) {
    this.database = database;
  }
  async getByTaskId(taskId) {
    const row = this.database.select().from(plansTable).where(eq2(plansTable.taskId, taskId)).get();
    return row ? toPlanRecord(row) : null;
  }
  async save(input) {
    const now = /* @__PURE__ */ new Date();
    const existing = this.database.select().from(plansTable).where(eq2(plansTable.taskId, input.taskId)).get();
    if (existing) {
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
      throw new Error("Plan was saved but could not be reloaded from the database.");
    }
    return saved;
  }
};

// src/main/db/project-repository.ts
import { randomUUID as randomUUID3 } from "crypto";
import { desc, eq as eq3 } from "drizzle-orm";
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
    const rows = this.database.select().from(projectsTable).orderBy(desc(projectsTable.updatedAt), desc(projectsTable.createdAt)).all();
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

// src/main/db/task-repository.ts
import { randomUUID as randomUUID4 } from "crypto";
import { and, desc as desc2, eq as eq4 } from "drizzle-orm";
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
    case "implementation":
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
    const id = randomUUID4();
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
      createdAt: tasksTable.createdAt,
      updatedAt: tasksTable.updatedAt
    }).from(tasksTable).innerJoin(projectsTable, eq4(tasksTable.projectId, projectsTable.id)).where(
      projectId ? and(eq4(tasksTable.id, taskId), eq4(tasksTable.projectId, projectId)) : eq4(tasksTable.id, taskId)
    ).get();
    return row ? toTaskRecord(row) : null;
  }
  async delete(taskId) {
    const result = this.database.delete(tasksTable).where(eq4(tasksTable.id, taskId)).run();
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
      createdAt: tasksTable.createdAt,
      updatedAt: tasksTable.updatedAt
    }).from(tasksTable).innerJoin(projectsTable, eq4(tasksTable.projectId, projectsTable.id)).where(projectId ? eq4(tasksTable.projectId, projectId) : void 0).orderBy(desc2(tasksTable.updatedAt)).all();
    return rows.map(toTaskRecord);
  }
  async touch(taskId) {
    this.database.update(tasksTable).set({
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq4(tasksTable.id, taskId)).run();
  }
  async updateStatus(taskId, status) {
    this.database.update(tasksTable).set({
      status,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq4(tasksTable.id, taskId)).run();
  }
};

// src/shared/contracts/desktop-api.ts
import { z } from "zod";
var agentProviderIdSchema = z.enum(["mcp"]);
var taskStatusSchema = z.enum(["new", "planning", "implementation", "completed"]);
var planSourceSchema = z.enum(["human", "agent"]);
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
var taskDetailSchema = z.object({
  project: projectRecordSchema,
  task: taskRecordSchema,
  plan: planRecordSchema.nullable(),
  agentSession: agentSessionRecordSchema.nullable()
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
  source: planSourceSchema.default("human")
});
var appendPlanNoteInputSchema = z.object({
  taskId: z.string(),
  note: z.string().trim().min(1).max(4e3)
});
var deleteTaskResultSchema = z.object({
  deletedTaskId: z.string()
});
var updateTaskStatusInputSchema = z.object({
  taskId: z.string(),
  status: taskStatusSchema
});

// src/main/services/app-service.ts
function createAppService(dependencies) {
  const getTaskDetail = async (taskId, projectId) => {
    const task = await dependencies.taskRepository.getById(taskId, projectId);
    if (!task) {
      throw new Error(`Task ${taskId} was not found.`);
    }
    const project = await dependencies.projectRepository.getById(task.projectId);
    if (!project) {
      throw new Error(`Project ${task.projectId} was not found.`);
    }
    const [plan, agentSession] = await Promise.all([
      dependencies.planRepository.getByTaskId(taskId),
      dependencies.agentSessionRepository.getByTaskId(taskId)
    ]);
    return {
      project,
      task,
      plan,
      agentSession
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
    async appendPlanNote(input) {
      const parsedInput = appendPlanNoteInputSchema.parse(input);
      const detail = await getTaskDetail(parsedInput.taskId);
      const currentPlan = detail.plan?.contentMd || `# \u041F\u043B\u0430\u043D \u0437\u0430\u0434\u0430\u0447\u0438

## \u0426\u0435\u043B\u044C
...

## \u041A\u043E\u043D\u0442\u0435\u043A\u0441\u0442
...

## \u0428\u0430\u0433\u0438
1. ...

## \u041E\u0442\u043A\u0440\u044B\u0442\u044B\u0435 \u0432\u043E\u043F\u0440\u043E\u0441\u044B
- ...

## \u041A\u0440\u0438\u0442\u0435\u0440\u0438\u0438 \u0433\u043E\u0442\u043E\u0432\u043D\u043E\u0441\u0442\u0438
- ...`;
      const nextContent = `${currentPlan.trim()}

## \u0417\u0430\u043C\u0435\u0442\u043A\u0438
- ${parsedInput.note.trim()}`;
      await dependencies.planRepository.save({
        taskId: parsedInput.taskId,
        contentMd: nextContent,
        source: "agent"
      });
      await dependencies.taskRepository.touch(parsedInput.taskId);
      await dependencies.projectRepository.touch(detail.task.projectId);
      return getTaskDetail(parsedInput.taskId);
    },
    async createProject(input) {
      const parsedInput = createProjectInputSchema.parse(input);
      return dependencies.projectRepository.create(parsedInput);
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
      return {
        deletedTaskId: taskId
      };
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
    async savePlan(input) {
      const parsedInput = savePlanInputSchema.parse(input);
      const detail = await getTaskDetail(parsedInput.taskId);
      await dependencies.planRepository.save(parsedInput);
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
      return getTaskDetail(parsedInput.taskId);
    },
    async updateTaskStatus(input) {
      const parsedInput = updateTaskStatusInputSchema.parse(input);
      const detail = await getTaskDetail(parsedInput.taskId);
      await dependencies.taskRepository.updateStatus(parsedInput.taskId, parsedInput.status);
      await dependencies.projectRepository.touch(detail.task.projectId);
      return getTaskDetail(parsedInput.taskId);
    },
    async updateProjectProfile(input) {
      const parsedInput = updateProjectProfileInputSchema.parse(input);
      return dependencies.projectRepository.updateProfile(parsedInput);
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
  appendPlanNote: "app:append-plan-note",
  createProject: "app:create-project",
  createTask: "app:create-task",
  deleteTask: "app:delete-task",
  getHealth: "app:get-health",
  getProject: "app:get-project",
  getTaskDetail: "app:get-task-detail",
  listProjects: "app:list-projects",
  listTasks: "app:list-tasks",
  savePlan: "app:save-plan",
  updateTaskStatus: "app:update-task-status",
  updateProjectProfile: "app:update-project-profile"
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
  ipcMain.handle(channels.getHealth, () => withIpcErrors(() => appService.getHealthSnapshot()));
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
    channels.savePlan,
    (_event, input) => withIpcErrors(() => appService.savePlan(input))
  );
  ipcMain.handle(
    channels.appendPlanNote,
    (_event, input) => withIpcErrors(() => appService.appendPlanNote(input))
  );
  ipcMain.handle(
    channels.updateTaskStatus,
    (_event, input) => withIpcErrors(() => appService.updateTaskStatus(input))
  );
  ipcMain.handle(
    channels.updateProjectProfile,
    (_event, input) => withIpcErrors(() => appService.updateProjectProfile(input))
  );
}

// src/main/mcp/mcp-http-server.ts
import { createServer } from "http";
import { randomUUID as randomUUID5 } from "crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

// src/main/mcp/create-mcp-server.ts
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z as z2 } from "zod";
function textContent(text2) {
  return [{ type: "text", text: text2 }];
}
function ensureStructuredPlan(plan, taskId) {
  return plan ?? { taskId, exists: false, contentMd: "" };
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
      description: "\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0443 \u0438 \u0435\u0435 \u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u043F\u043B\u0430\u043D \u0432\u043D\u0443\u0442\u0440\u0438 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430.",
      inputSchema: {
        taskId: z2.string()
      }
    },
    async ({ taskId }) => {
      logger.debug("mcp", "Tool get_task called", { taskId });
      const { detail, project } = await getScopedTaskDetail(taskId);
      return {
        content: textContent(JSON.stringify(detail, null, 2)),
        structuredContent: { ...detail, project }
      };
    }
  );
  server.registerTool(
    "update_task_status",
    {
      description: "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0441\u0442\u0430\u0442\u0443\u0441 \u0437\u0430\u0434\u0430\u0447\u0438 \u0432\u043D\u0443\u0442\u0440\u0438 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430. \u0414\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0435 \u0441\u0442\u0430\u0442\u0443\u0441\u044B: new, planning, implementation, completed.",
      inputSchema: {
        taskId: z2.string(),
        status: z2.enum(["new", "planning", "implementation", "completed"])
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
      description: "\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0442\u0435\u043A\u0443\u0449\u0438\u0439 Markdown-\u043F\u043B\u0430\u043D \u0437\u0430\u0434\u0430\u0447\u0438 \u0432\u043D\u0443\u0442\u0440\u0438 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430.",
      inputSchema: {
        taskId: z2.string()
      }
    },
    async ({ taskId }) => {
      logger.debug("mcp", "Tool get_plan called", { taskId });
      const { detail } = await getScopedTaskDetail(taskId);
      return {
        content: textContent(detail.plan?.contentMd ?? ""),
        structuredContent: ensureStructuredPlan(detail.plan, taskId)
      };
    }
  );
  server.registerTool(
    "save_plan",
    {
      description: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C Markdown-\u043F\u043B\u0430\u043D \u0434\u043B\u044F \u0437\u0430\u0434\u0430\u0447\u0438 \u0432\u043D\u0443\u0442\u0440\u0438 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430.",
      inputSchema: {
        taskId: z2.string(),
        contentMd: z2.string().min(1),
        source: z2.enum(["human", "agent"]).optional()
      }
    },
    async ({ contentMd, source, taskId }) => {
      await getScopedTaskDetail(taskId);
      logger.info("mcp", "Tool save_plan called", { taskId, source: source ?? "agent" });
      const detail = await appService.savePlan({
        taskId,
        contentMd,
        source: source ?? "agent"
      });
      return {
        content: textContent("\u041F\u043B\u0430\u043D \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D."),
        structuredContent: ensureStructuredPlan(detail.plan, taskId)
      };
    }
  );
  server.registerTool(
    "append_plan_note",
    {
      description: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0437\u0430\u043C\u0435\u0442\u043A\u0443 \u0438\u043B\u0438 \u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0439 \u0432\u043E\u043F\u0440\u043E\u0441 \u0432 \u043F\u043B\u0430\u043D \u0437\u0430\u0434\u0430\u0447\u0438 \u0432\u043D\u0443\u0442\u0440\u0438 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430.",
      inputSchema: {
        taskId: z2.string(),
        note: z2.string().min(1)
      }
    },
    async ({ note, taskId }) => {
      await getScopedTaskDetail(taskId);
      logger.info("mcp", "Tool append_plan_note called", { taskId });
      const detail = await appService.appendPlanNote({ taskId, note });
      return {
        content: textContent("\u0417\u0430\u043C\u0435\u0442\u043A\u0430 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0430 \u0432 \u043F\u043B\u0430\u043D."),
        structuredContent: ensureStructuredPlan(detail.plan, taskId)
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
\u0415\u0441\u043B\u0438 \u0443 \u0437\u0430\u0434\u0430\u0447\u0438 \u0443\u0436\u0435 \u0435\u0441\u0442\u044C \u043F\u043B\u0430\u043D \u0438\u043B\u0438 \u0437\u0430\u043C\u0435\u0442\u043A\u0438, \u0442\u0430\u043A\u0436\u0435 \u0432\u044B\u0437\u043E\u0432\u0438 get_plan.

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

## \u041E\u0442\u043A\u0440\u044B\u0442\u044B\u0435 \u0432\u043E\u043F\u0440\u043E\u0441\u044B
- ...

## \u041A\u0440\u0438\u0442\u0435\u0440\u0438\u0438 \u0433\u043E\u0442\u043E\u0432\u043D\u043E\u0441\u0442\u0438
- ...

7. \u0421\u043E\u0445\u0440\u0430\u043D\u0438 \u0438\u0442\u043E\u0433\u043E\u0432\u044B\u0439 Markdown \u0447\u0435\u0440\u0435\u0437 save_plan \u0441 source="agent".

8. \u041F\u043E\u0441\u043B\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043F\u0435\u0440\u0435\u0432\u0435\u0434\u0438 \u0437\u0430\u0434\u0430\u0447\u0443 \u0432 \u0441\u0442\u0430\u0442\u0443\u0441 implementation \u0447\u0435\u0440\u0435\u0437 update_task_status.

9. \u041F\u043E\u0441\u043B\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043E\u0442\u0432\u0435\u0442\u044C \u043A\u0440\u0430\u0442\u043A\u043E:
- \u043A\u0430\u043A\u043E\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u0431\u044B\u043B \u0430\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u043D
- \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0431\u044B\u043B\u0430 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u0430 \u0438\u043B\u0438 \u0443\u0436\u0435 \u0431\u044B\u043B\u0430 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u0430
- \u043A\u0430\u043A\u0430\u044F \u0437\u0430\u0434\u0430\u0447\u0430 \u0431\u044B\u043B\u0430 \u0440\u0430\u0441\u043F\u043B\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0430
- \u043A\u0430\u043A\u043E\u0439 \u0441\u0442\u0430\u0442\u0443\u0441 \u0431\u044B\u043B \u0432\u044B\u0441\u0442\u0430\u0432\u043B\u0435\u043D \u043F\u043E\u0441\u043B\u0435 \u043F\u043B\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F
- \u043F\u043B\u0430\u043D \u0431\u044B\u043B \u0441\u043E\u0437\u0434\u0430\u043D \u0438\u043B\u0438 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D
- \u043A\u043E\u0440\u043E\u0442\u043A\u0430\u044F \u0441\u0432\u043E\u0434\u043A\u0430 \u043F\u043B\u0430\u043D\u0430

\u041D\u0435 \u043E\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0439\u0441\u044F \u043F\u043E\u0441\u043B\u0435 \u0430\u043D\u0430\u043B\u0438\u0437\u0430. \u0421\u043E\u0445\u0440\u0430\u043D\u0438 Markdown \u043E\u0431\u0440\u0430\u0442\u043D\u043E \u0432 AITasker \u0434\u043E \u0444\u0438\u043D\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u043E\u0442\u0432\u0435\u0442\u0430.`
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
            text: detail.plan?.contentMd ?? ""
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
        sessionIdGenerator: () => randomUUID5(),
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

// src/main/index.ts
var CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
var APP_ROOT = join2(CURRENT_DIR, "..", "..");
var RENDERER_DIST = join2(APP_ROOT, "dist");
var PRELOAD_SCRIPT = join2(APP_ROOT, "preload.js");
var VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
var mainWindow = null;
async function createMainWindow(runtime) {
  mainWindow = new runtime.BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    show: false,
    title: "AITasker",
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
  await mainWindow.loadFile(join2(RENDERER_DIST, "index.html"));
}
function bootstrapMainProcess(runtime) {
  runtime.app.whenReady().then(async () => {
    const databaseContext = createAppDatabase(runtime.app.getPath("userData"));
    const logger = createDevLogger();
    const taskRepository = new TaskRepository(databaseContext.database);
    const planRepository = new PlanRepository(databaseContext.database);
    const projectRepository = new ProjectRepository(databaseContext.database);
    const agentSessionRepository = new AgentSessionRepository(databaseContext.database);
    const agentRegistry = createAgentRegistry();
    let appService;
    let mcpHttpServer = null;
    appService = createAppService({
      agentProviders: agentRegistry.providers,
      agentSessionRepository,
      databasePath: databaseContext.databasePath,
      getMcpEndpoint: () => mcpHttpServer?.endpoint ?? null,
      isMcpRunning: () => mcpHttpServer?.isRunning ?? false,
      planRepository,
      platform: process.platform,
      projectRepository,
      taskRepository
    });
    mcpHttpServer = new McpHttpServer(appService, logger);
    await mcpHttpServer.start();
    logger.info("app", "Main process initialized", {
      databasePath: databaseContext.databasePath,
      mcpEndpoint: mcpHttpServer.endpoint
    });
    registerIpcHandlers(runtime.ipcMain, appService);
    await createMainWindow(runtime);
    runtime.app.on("activate", async () => {
      if (runtime.BrowserWindow.getAllWindows().length === 0) {
        await createMainWindow(runtime);
      }
    });
    runtime.app.once("before-quit", async () => {
      await mcpHttpServer?.stop();
    });
  });
  runtime.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      runtime.app.quit();
    }
  });
}
export {
  bootstrapMainProcess
};
//# sourceMappingURL=index.js.map