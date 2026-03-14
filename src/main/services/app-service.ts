/*
Назначение: Дает renderer и MCP единый сервисный API для работы с проектами, задачами и планами.
Не входит: Детали IPC-транспорта, управление Electron-окнами и низкоуровневый bootstrap SQLite.
*/
import type {
  AppendPlanNoteInput,
  AppHealthSnapshot,
  CreateProjectInput,
  CreateTaskInput,
  DeleteTaskResult,
  ProjectRecord,
  SavePlanInput,
  TaskDetail,
  TaskRecord,
  TaskStatus,
  UpdateTaskStatusInput,
  UpdateProjectProfileInput
} from "../../shared/contracts/desktop-api";
import {
  appendPlanNoteInputSchema,
  createProjectInputSchema,
  createTaskInputSchema,
  savePlanInputSchema,
  updateTaskStatusInputSchema,
  updateProjectProfileInputSchema
} from "../../shared/contracts/desktop-api";
import type { AgentSessionRepository } from "../db/agent-session-repository";
import type { PlanRepository } from "../db/plan-repository";
import type { ProjectRepository } from "../db/project-repository";
import type { TaskRepository } from "../db/task-repository";

export interface AppServiceDependencies {
  agentProviders: ReadonlyArray<AppHealthSnapshot["agentProviders"][number]>;
  agentSessionRepository: AgentSessionRepository;
  databasePath: string;
  getMcpEndpoint(): string | null;
  isMcpRunning(): boolean;
  planRepository: PlanRepository;
  platform: string;
  projectRepository: ProjectRepository;
  taskRepository: TaskRepository;
}

export interface AppService {
  appendPlanNote(input: AppendPlanNoteInput): Promise<TaskDetail>;
  createProject(input: CreateProjectInput): Promise<ProjectRecord>;
  createTask(input: CreateTaskInput): Promise<TaskDetail>;
  deleteTask(taskId: string): Promise<DeleteTaskResult>;
  getHealthSnapshot(): AppHealthSnapshot;
  getProject(projectId: string): Promise<ProjectRecord | null>;
  getTaskDetail(taskId: string, projectId?: string): Promise<TaskDetail>;
  listProjects(): Promise<ProjectRecord[]>;
  listTasks(projectId?: string): Promise<TaskRecord[]>;
  savePlan(input: SavePlanInput): Promise<TaskDetail>;
  updateTaskStatus(input: UpdateTaskStatusInput): Promise<TaskDetail>;
  updateProjectProfile(input: UpdateProjectProfileInput): Promise<ProjectRecord>;
}

export function createAppService(dependencies: AppServiceDependencies): AppService {
  const getTaskDetail = async (taskId: string, projectId?: string): Promise<TaskDetail> => {
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

  const resolveProjectForTask = async (input: CreateTaskInput): Promise<ProjectRecord> => {
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
      const currentPlan =
        detail.plan?.contentMd ||
        `# План задачи

## Цель
...

## Контекст
...

## Шаги
1. ...

## Открытые вопросы
- ...

## Критерии готовности
- ...`;
      const nextContent = `${currentPlan.trim()}

## Заметки
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

      await dependencies.taskRepository.updateStatus(parsedInput.taskId, parsedInput.status as TaskStatus);
      await dependencies.projectRepository.touch(detail.task.projectId);

      return getTaskDetail(parsedInput.taskId);
    },
    async updateProjectProfile(input) {
      const parsedInput = updateProjectProfileInputSchema.parse(input);

      return dependencies.projectRepository.updateProfile(parsedInput);
    }
  };
}
