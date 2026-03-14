/*
Назначение: Управляет сохранением, чтением и обновлением карточек проектов в локальной SQLite-базе.
Не входит: Работа с задачами, IPC и MCP-оркестрация.
*/
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type {
  CreateProjectInput,
  ProjectRecord,
  UpdateProjectProfileInput
} from "../../shared/contracts/desktop-api";
import type { AppDatabase } from "./database";
import { projectsTable } from "./schema";

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeLanguages(languages: string[]): string[] {
  return Array.from(
    new Set(
      languages
        .map((language) => normalizeWhitespace(language))
        .filter((language) => language.length > 0)
    )
  ).sort((left, right) => left.localeCompare(right, "ru-RU"));
}

function buildDefaultSkillPrompt(projectName: string): string {
  return `Создай или обнови SKILL.md для проекта "${projectName}". Опиши типовые workflow, ограничения, соглашения по коду и шаги для выполнения задач по проекту.`;
}

function isProfileComplete(row: typeof projectsTable.$inferSelect): boolean {
  return Boolean(row.description.trim() && row.rootPath?.trim() && parseLanguages(row.languagesJson).length > 0);
}

function parseLanguages(languagesJson: string): string[] {
  try {
    const parsed = JSON.parse(languagesJson);

    return Array.isArray(parsed) ? normalizeLanguages(parsed.filter((value): value is string => typeof value === "string")) : [];
  } catch {
    return [];
  }
}

function toProjectRecord(row: typeof projectsTable.$inferSelect): ProjectRecord {
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

export function normalizeProjectName(name: string): string {
  return normalizeWhitespace(name).toLocaleLowerCase("ru-RU");
}

function sanitizeProjectName(name: string): string {
  return normalizeWhitespace(name);
}

export class ProjectRepository {
  constructor(private readonly database: AppDatabase) {}

  async create(input: CreateProjectInput): Promise<ProjectRecord> {
    const existing = await this.findByName(input.name);

    if (existing) {
      return existing;
    }

    const now = new Date();
    const sanitizedName = sanitizeProjectName(input.name);
    const id = randomUUID();

    this.database
      .insert(projectsTable)
      .values({
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
      })
      .run();

    const created = await this.getById(id);

    if (!created) {
      throw new Error("Проект создан, но не удалось прочитать его из базы.");
    }

    return created;
  }

  async findByName(name: string): Promise<ProjectRecord | null> {
    const row = this.database
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.normalizedName, normalizeProjectName(name)))
      .get();

    return row ? toProjectRecord(row) : null;
  }

  async getById(projectId: string): Promise<ProjectRecord | null> {
    const row = this.database.select().from(projectsTable).where(eq(projectsTable.id, projectId)).get();

    return row ? toProjectRecord(row) : null;
  }

  async list(): Promise<ProjectRecord[]> {
    const rows = this.database
      .select()
      .from(projectsTable)
      .orderBy(desc(projectsTable.updatedAt), desc(projectsTable.createdAt))
      .all();

    return rows.map(toProjectRecord);
  }

  async touch(projectId: string): Promise<void> {
    this.database
      .update(projectsTable)
      .set({
        updatedAt: new Date()
      })
      .where(eq(projectsTable.id, projectId))
      .run();
  }

  async updateProfile(input: UpdateProjectProfileInput): Promise<ProjectRecord> {
    const existing = this.database
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, input.projectId))
      .get();

    if (!existing) {
      throw new Error(`Проект ${input.projectId} не найден.`);
    }

    const nextName = input.name ? sanitizeProjectName(input.name) : existing.name;
    const nextDescription = input.description !== undefined ? input.description.trim() : existing.description;
    const nextRootPath =
      input.rootPath !== undefined ? (input.rootPath ? input.rootPath.trim() : null) : existing.rootPath;
    const nextLanguages =
      input.languages !== undefined ? JSON.stringify(normalizeLanguages(input.languages)) : existing.languagesJson;
    const nextSkillFilePath =
      input.skillFilePath !== undefined
        ? input.skillFilePath
          ? input.skillFilePath.trim()
          : null
        : existing.skillFilePath;
    const nextSkillPrompt =
      input.skillPrompt !== undefined
        ? input.skillPrompt.trim()
        : existing.skillPrompt || buildDefaultSkillPrompt(nextName);

    this.database
      .update(projectsTable)
      .set({
        name: nextName,
        normalizedName: normalizeProjectName(nextName),
        description: nextDescription,
        rootPath: nextRootPath,
        languagesJson: nextLanguages,
        skillFilePath: nextSkillFilePath,
        skillPrompt: nextSkillPrompt,
        updatedAt: new Date()
      })
      .where(eq(projectsTable.id, input.projectId))
      .run();

    const updated = await this.getById(input.projectId);

    if (!updated) {
      throw new Error(`Проект ${input.projectId} обновлен, но не удалось перечитать карточку.`);
    }

    return updated;
  }
}
