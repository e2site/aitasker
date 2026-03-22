/*
Назначение: Хранит и предоставляет общий контекст MCP-контроллера: активный проект, состояние агентской сессии и общие helper-функции.
Не входит: Регистрация MCP-инструментов, prompt-ов и resource-шаблонов.
*/
import { createTaskContext } from "../../services/task-context";
import { normalizeProjectName } from "../../db/project-repository";
import { createFreshSession, generateRunId, touchSession } from "../agent-session";
import type { AgentSession } from "../agent-session";
import type { AppService } from "../../services/app-service";
import type { DevLogger } from "../../services/dev-logger";

export type ProjectRecord = Awaited<ReturnType<AppService["listProjects"]>>[number];
export type TaskRecord = Awaited<ReturnType<AppService["listTasks"]>>[number];

export interface ResolvedProjectReference {
  project: ProjectRecord | null;
  matches: ProjectRecord[];
}

export function textContent(text: string) {
  return [{ type: "text" as const, text }];
}

export function findProjectsByQuery(projects: ProjectRecord[], query: string, limit: number) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");

  return projects
    .filter((project) => {
      const haystack = [
        project.id,
        project.name,
        project.description,
        project.rootPath ?? "",
        project.languages.join(" "),
        project.skillFilePath ?? ""
      ]
        .join(" ")
        .toLocaleLowerCase("ru-RU");

      return haystack.includes(normalizedQuery);
    })
    .slice(0, limit);
}

export function findTasksByQuery(tasks: TaskRecord[], query: string, limit: number) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");

  return tasks
    .filter((task) => {
      const haystack = [
        task.id,
        task.projectId,
        task.projectName,
        task.title,
        task.description,
        task.status
      ]
        .join(" ")
        .toLocaleLowerCase("ru-RU");

      return haystack.includes(normalizedQuery);
    })
    .slice(0, limit);
}

export function resolveProjectReference(projects: ProjectRecord[], projectRef: string): ResolvedProjectReference {
  const trimmedRef = projectRef.trim();
  const normalizedRef = normalizeProjectName(trimmedRef);
  const exactMatch =
    projects.find((project) => project.id === trimmedRef) ??
    projects.find((project) => normalizeProjectName(project.name) === normalizedRef);

  if (exactMatch) {
    return { project: exactMatch, matches: [] };
  }

  const matches = findProjectsByQuery(projects, trimmedRef, 10);

  return {
    project: matches.length === 1 ? matches[0] : null,
    matches
  };
}

export function getProjectProfileHint(project: ProjectRecord): string {
  const missingFields: string[] = [];

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
    return `Профиль проекта ${project.name} заполнен.`;
  }

  return `Профиль проекта ${project.name} не заполнен: ${missingFields.join(", ")}. Сначала вызовите update_project_profile.`;
}

export class McpControllerContext {
  private activeProjectId: string | null = null;
  private agentSession: AgentSession = createFreshSession(generateRunId());

  constructor(
    private readonly appService: AppService,
    private readonly logger: DevLogger
  ) {}

  getAppService() {
    return this.appService;
  }

  getLogger() {
    return this.logger;
  }

  getActiveProjectId() {
    return this.activeProjectId;
  }

  setActiveProjectId(projectId: string | null) {
    this.activeProjectId = projectId;
  }

  resetSession() {
    this.agentSession = createFreshSession(generateRunId());
  }

  getAgentSession() {
    return this.agentSession;
  }

  updateAgentSession(next: AgentSession) {
    this.agentSession = next;
  }

  touchSession(patch: { taskId?: string; mode?: AgentSession["lastMode"] }) {
    this.agentSession = touchSession(this.agentSession, patch);
  }

  async requireActiveProject(): Promise<ProjectRecord> {
    if (!this.activeProjectId) {
      throw new Error("Проект не активирован. Сначала вызовите activate_project.");
    }

    const project = await this.appService.getProject(this.activeProjectId);

    if (!project) {
      this.activeProjectId = null;
      throw new Error("Активный проект больше не существует. Активируйте проект заново.");
    }

    return project;
  }

  async requirePreparedProject(): Promise<ProjectRecord> {
    const project = await this.requireActiveProject();

    if (!project.isProfileComplete) {
      throw new Error(getProjectProfileHint(project));
    }

    return project;
  }

  async requireTaskContext(taskId: string) {
    await this.requirePreparedProject();

    return createTaskContext(taskId, this.appService);
  }
}
