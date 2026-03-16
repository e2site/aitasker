/*
Назначение: Описывает Drizzle-схему SQLite для проектов, задач, текущих планов, ревизий планов и сессий агента.
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

export const databaseSchema = {
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
