/*
Назначение: Создает и мягко обновляет SQLite-таблицы приложения при запуске, включая миграции задач, проектов и ревизий планов.
Не входит: Генерация Drizzle-миграций и бизнес-логика доступа к данным.
*/
import type Database from "better-sqlite3";

const DEFAULT_PROJECT_ID = "project-general";
const DEFAULT_PROJECT_NAME = "Общее";
const DEFAULT_PROJECT_NORMALIZED_NAME = "общее";
const DEFAULT_PROJECT_DESCRIPTION = "";
const DEFAULT_PROJECT_LANGUAGES_JSON = "[]";
const DEFAULT_PROJECT_SKILL_PROMPT = "";

function hasColumn(sqlite: Database.Database, tableName: string, columnName: string): boolean {
  const rows = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;

  return rows.some((row) => row.name === columnName);
}

export function bootstrapDatabase(sqlite: Database.Database): void {
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
  sqlite
    .prepare(
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
    )
    .run(
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

  sqlite
    .prepare(
      `
        UPDATE tasks
        SET project_id = ?
        WHERE project_id IS NULL OR TRIM(project_id) = ''
      `
    )
    .run(DEFAULT_PROJECT_ID);

  sqlite
    .prepare(
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
    )
    .run();

  sqlite
    .prepare(
      `
        UPDATE projects
        SET
          description = COALESCE(description, ''),
          languages_json = COALESCE(NULLIF(languages_json, ''), '[]'),
          skill_prompt = COALESCE(skill_prompt, '')
      `
    )
    .run();

  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_plan_revisions_task_id ON plan_revisions(task_id);
    CREATE INDEX IF NOT EXISTS idx_plan_revisions_plan_id ON plan_revisions(plan_id);
  `);
}
