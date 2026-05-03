/*
Назначение: Описывает Drizzle-схему SQLite для проектов, задач, подсказок, текущих планов, task context, ревизий планов и сессий агента.
Не входит: Реализация запросов, подключение к базе и выполнение миграций.
*/
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const projectsTable = sqliteTable("projects", {
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

export const tasksTable = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const plansTable = sqliteTable("plans", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .unique()
    .references(() => tasksTable.id, { onDelete: "cascade" }),
  contentMd: text("content_md").notNull(),
  source: text("source").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const planRevisionsTable = sqliteTable("plan_revisions", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => plansTable.id, { onDelete: "cascade" }),
  taskId: text("task_id")
    .notNull()
    .references(() => tasksTable.id, { onDelete: "cascade" }),
  contentMd: text("content_md").notNull(),
  source: text("source").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
});

export const agentSessionsTable = sqliteTable("agent_sessions", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .unique()
    .references(() => tasksTable.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  externalSessionId: text("external_session_id"),
  externalThreadId: text("external_thread_id"),
  status: text("status").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const taskLinksTable = sqliteTable("task_links", {
  id: text("id").primaryKey(),
  sourceTaskId: text("source_task_id")
    .notNull()
    .references(() => tasksTable.id, { onDelete: "cascade" }),
  targetTaskId: text("target_task_id")
    .notNull()
    .references(() => tasksTable.id, { onDelete: "cascade" }),
  comment: text("comment").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
});

export const promptOverridesTable = sqliteTable("prompt_overrides", {
  id: text("id").primaryKey(),
  template: text("template").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const promptHintsTable = sqliteTable("prompt_hints", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const resourcesTable = sqliteTable("resources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  contentMd: text("content_md").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const taskResourcesTable = sqliteTable("task_resources", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasksTable.id, { onDelete: "cascade" }),
  resourceId: text("resource_id")
    .notNull()
    .references(() => resourcesTable.id, { onDelete: "cascade" }),
  comment: text("comment").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
});

export const planCommentsTable = sqliteTable("plan_comments", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => plansTable.id, { onDelete: "cascade" }),
  taskId: text("task_id")
    .notNull()
    .references(() => tasksTable.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // "discussion" | "extension" | "improvement"
  author: text("author").notNull(), // "human" | "agent"
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const planQuestionsTable = sqliteTable("plan_questions", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => plansTable.id, { onDelete: "cascade" }),
  taskId: text("task_id")
    .notNull()
    .references(() => tasksTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  answer: text("answer"),
  answeredAt: integer("answered_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const taskGoalsTable = sqliteTable("task_goals", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasksTable.id, { onDelete: "cascade" }),
  value: text("value").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const taskCriticalConditionsTable = sqliteTable("task_critical_conditions", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasksTable.id, { onDelete: "cascade" }),
  value: text("value").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const taskForbiddenInterpretationsTable = sqliteTable("task_forbidden_interpretations", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasksTable.id, { onDelete: "cascade" }),
  value: text("value").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const taskAcceptanceCriteriaTable = sqliteTable("task_acceptance_criteria", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasksTable.id, { onDelete: "cascade" }),
  value: text("value").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const databaseSchema = {
  agentSessionsTable,
  planCommentsTable,
  planQuestionsTable,
  planRevisionsTable,
  plansTable,
  projectsTable,
  promptHintsTable,
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
