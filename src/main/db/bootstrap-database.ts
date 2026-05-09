/*
Назначение: Создает и мягко обновляет SQLite-таблицы приложения при запуске, включая миграции задач с подзадачами, проектов, подсказок, task context и ревизий планов.
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
      parent_task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
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

    CREATE TABLE IF NOT EXISTS prompt_hints (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
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

  if (!hasColumn(sqlite, "tasks", "parent_task_id")) {
    sqlite.exec(`ALTER TABLE tasks ADD COLUMN parent_task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE;`);
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
    CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
    CREATE INDEX IF NOT EXISTS idx_plan_revisions_task_id ON plan_revisions(task_id);
    CREATE INDEX IF NOT EXISTS idx_plan_revisions_plan_id ON plan_revisions(plan_id);
    CREATE INDEX IF NOT EXISTS idx_task_links_source_task_id ON task_links(source_task_id);
    CREATE INDEX IF NOT EXISTS idx_task_links_target_task_id ON task_links(target_task_id);
    CREATE INDEX IF NOT EXISTS idx_prompt_hints_project_id ON prompt_hints(project_id);
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
