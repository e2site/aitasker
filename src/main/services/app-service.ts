/*
Назначение: Дает renderer и MCP единый сервисный API для работы с проектами, задачами, планами, расширениями и доработками.
Не входит: Детали IPC-транспорта, управление Electron-окнами и низкоуровневый bootstrap SQLite.
*/
import type {
  AnswerPlanQuestionInput,
  AppendPlanExtensionInput,
  AppendPlanImprovementInput,
  AppHealthSnapshot,
  ConsolidatePlanDiscussionInput,
  CreateProjectInput,
  CreateResourceInput,
  CreateTaskInput,
  DeletePromptOverrideInput,
  DesktopDataChangeEvent,
  DeleteTaskResult,
  LinkResourceInput,
  LinkTaskInput,
  ProjectRecord,
  PromptOverrideRecord,
  ResourceRecord,
  RestorePlanRevisionInput,
  SavePlanInput,
  TaskDetail,
  TaskRecord,
  TaskStatus,
  UnlinkResourceInput,
  UnlinkTaskInput,
  UpdateResourceInput,
  UpdateTaskInput,
  UpdateTaskStatusInput,
  UpdateProjectProfileInput,
  UpsertPromptOverrideInput
} from "../../shared/contracts/desktop-api";
import {
  answerPlanQuestionInputSchema,
  appendPlanExtensionInputSchema,
  appendPlanImprovementInputSchema,
  consolidatePlanDiscussionInputSchema,
  createProjectInputSchema,
  createResourceInputSchema,
  createTaskInputSchema,
  deletePromptOverrideInputSchema,
  linkResourceInputSchema,
  linkTaskInputSchema,
  restorePlanRevisionInputSchema,
  savePlanInputSchema,
  unlinkResourceInputSchema,
  unlinkTaskInputSchema,
  updateResourceInputSchema,
  updateTaskInputSchema,
  updateTaskStatusInputSchema,
  updateProjectProfileInputSchema,
  upsertPromptOverrideInputSchema
} from "../../shared/contracts/desktop-api";
import {
  answerManagedPlanQuestion,
  appendManagedPlanBlock,
  consolidateManagedPlanDiscussion,
  extractBasePlanContent,
  replaceManagedPlanQuestions,
  replaceBasePlanContent
} from "../../shared/plans/managed-plan-content";
import type { AgentSessionRepository } from "../db/agent-session-repository";
import type { PlanRepository } from "../db/plan-repository";
import type { PromptOverrideRepository } from "../db/prompt-override-repository";
import type { ProjectRepository } from "../db/project-repository";
import type { ResourceRepository } from "../db/resource-repository";
import type { TaskLinkRepository } from "../db/task-link-repository";
import type { TaskResourceRepository } from "../db/task-resource-repository";
import type { TaskRepository } from "../db/task-repository";

export interface AppServiceDependencies {
  agentProviders: ReadonlyArray<AppHealthSnapshot["agentProviders"][number]>;
  agentSessionRepository: AgentSessionRepository;
  databasePath: string;
  getMcpEndpoint(): string | null;
  isMcpRunning(): boolean;
  onDataChanged?(event: DesktopDataChangeEvent): void;
  planRepository: PlanRepository;
  platform: string;
  projectRepository: ProjectRepository;
  promptOverrideRepository: PromptOverrideRepository;
  relaunchApp(): void;
  resourceRepository: ResourceRepository;
  sqlite: import("better-sqlite3").Database;
  taskLinkRepository: TaskLinkRepository;
  taskRepository: TaskRepository;
  taskResourceRepository: TaskResourceRepository;
}

export interface AppService {
  answerPlanQuestion(input: AnswerPlanQuestionInput): Promise<TaskDetail>;
  appendPlanExtension(input: AppendPlanExtensionInput): Promise<TaskDetail>;
  appendPlanImprovement(input: AppendPlanImprovementInput): Promise<TaskDetail>;
  consolidatePlanDiscussion(input: ConsolidatePlanDiscussionInput): Promise<TaskDetail>;
  createProject(input: CreateProjectInput): Promise<ProjectRecord>;
  createResource(input: CreateResourceInput): Promise<ResourceRecord>;
  createTask(input: CreateTaskInput): Promise<TaskDetail>;
  deletePromptOverride(input: DeletePromptOverrideInput): Promise<void>;
  deleteResource(id: string): Promise<void>;
  deleteTask(taskId: string): Promise<DeleteTaskResult>;
  exportData(): Promise<{ filePath: string } | null>;
  getHealthSnapshot(): AppHealthSnapshot;
  getProject(projectId: string): Promise<ProjectRecord | null>;
  getResource(id: string): Promise<ResourceRecord>;
  getTaskDetail(taskId: string, projectId?: string): Promise<TaskDetail>;
  importData(): Promise<void>;
  linkResource(input: LinkResourceInput): Promise<TaskDetail>;
  linkTask(input: LinkTaskInput): Promise<TaskDetail>;
  listPromptOverrides(): Promise<PromptOverrideRecord[]>;
  listProjects(): Promise<ProjectRecord[]>;
  listResources(): Promise<ResourceRecord[]>;
  listTasks(projectId?: string): Promise<TaskRecord[]>;
  restorePlanRevision(input: RestorePlanRevisionInput): Promise<TaskDetail>;
  savePlan(input: SavePlanInput): Promise<TaskDetail>;
  unlinkResource(input: UnlinkResourceInput): Promise<TaskDetail>;
  unlinkTask(input: UnlinkTaskInput): Promise<TaskDetail>;
  updateResource(input: UpdateResourceInput): Promise<ResourceRecord>;
  updateTask(input: UpdateTaskInput): Promise<TaskDetail>;
  updateTaskStatus(input: UpdateTaskStatusInput): Promise<TaskDetail>;
  updateProjectProfile(input: UpdateProjectProfileInput): Promise<ProjectRecord>;
  upsertPromptOverride(input: UpsertPromptOverrideInput): Promise<PromptOverrideRecord>;
}

export function createAppService(dependencies: AppServiceDependencies): AppService {
  const emitDataChanged = (event: DesktopDataChangeEvent) => {
    dependencies.onDataChanged?.(event);
  };

  const getTaskDetail = async (taskId: string, projectId?: string): Promise<TaskDetail> => {
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
    async answerPlanQuestion(input) {
      const parsedInput = answerPlanQuestionInputSchema.parse(input);
      const detail = await getTaskDetail(parsedInput.taskId);

      if (!detail.plan) {
        throw new Error("Сначала создайте или сохраните базовый план, затем отвечайте на вопросы.");
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
        throw new Error("Сначала создайте или сохраните базовый план, затем добавляйте его расширения.");
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
        throw new Error("Сначала создайте или сохраните базовый план, затем добавляйте его доработки.");
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
        title: "Сохранить данные AITasker",
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
        title: "Загрузить данные AITasker",
        filters: [{ name: "SQLite Database", extensions: ["sqlite"] }],
        properties: ["openFile"]
      });

      if (result.canceled || result.filePaths.length === 0) {
        return;
      }

      const sourcePath = result.filePaths[0];
      const { copyFileSync } = await import("node:fs");
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
      const finalContentMd =
        parsedInput.openQuestions === undefined
          ? nextContentMd
          : replaceManagedPlanQuestions(nextContentMd, parsedInput.openQuestions);

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

      await dependencies.taskRepository.updateStatus(parsedInput.taskId, parsedInput.status as TaskStatus);
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
        throw new Error(`Связь ${parsedInput.linkId} не найдена.`);
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
        throw new Error(`Связь ресурса ${parsedInput.linkId} не найдена.`);
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
