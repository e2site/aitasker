/*
Назначение: Дает renderer и MCP единый сервисный API для работы с проектами, задачами, планами, task context, расширениями и доработками.
Не входит: Детали IPC-транспорта, управление Electron-окнами и низкоуровневый bootstrap SQLite.
*/
import type {
  AddPlanQuestionInput,
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
  PlanCommentRecord,
  PlanQuestionRecord,
  ProjectRecord,
  PromptOverrideRecord,
  ResourceRecord,
  RestorePlanRevisionInput,
  SavePlanInput,
  TaskContextRecord,
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
  addPlanQuestionInputSchema,
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
  consolidateManagedPlanDiscussion,
  extractBasePlanContent,
  replaceManagedPlanQuestions,
  replaceBasePlanContent
} from "../../shared/plans/managed-plan-content";
import type { AgentSessionRepository } from "../db/agent-session-repository";
import type { PlanCommentRepository } from "../db/plan-comment-repository";
import type { PlanRepository } from "../db/plan-repository";
import type { PromptOverrideRepository } from "../db/prompt-override-repository";
import type { ProjectRepository } from "../db/project-repository";
import type { ResourceRepository } from "../db/resource-repository";
import type { TaskContextRepository } from "../db/task-context-repository";
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
  planCommentRepository: PlanCommentRepository;
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
  taskContextRepository: TaskContextRepository;
}

export interface AppService {
  addPlanQuestion(input: AddPlanQuestionInput): Promise<PlanQuestionRecord>;
  answerPlanQuestion(input: AnswerPlanQuestionInput): Promise<PlanQuestionRecord>;
  appendPlanExtension(input: AppendPlanExtensionInput): Promise<PlanCommentRecord>;
  appendPlanImprovement(input: AppendPlanImprovementInput): Promise<PlanCommentRecord>;
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

  const hasTaskContextPatch = (input: SavePlanInput): boolean => {
    return (
      input.goal !== undefined ||
      input.criticalConditions !== undefined ||
      input.forbiddenInterpretations !== undefined ||
      input.acceptanceCriteria !== undefined
    );
  };

  const mergeTaskContext = (current: TaskContextRecord, input: SavePlanInput): TaskContextRecord => {
    return {
      goal: input.goal ?? current.goal,
      criticalConditions: input.criticalConditions ?? current.criticalConditions,
      forbiddenInterpretations: input.forbiddenInterpretations ?? current.forbiddenInterpretations,
      acceptanceCriteria: input.acceptanceCriteria ?? current.acceptanceCriteria
    };
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

    const [plan, planRevisions, planComments, planQuestions, taskContext, agentSession, linkedTasks, linkedResources] =
      await Promise.all([
        dependencies.planRepository.getByTaskId(taskId),
        dependencies.planRepository.listRevisions(taskId),
        dependencies.planCommentRepository.listCommentsByTaskId(taskId),
        dependencies.planCommentRepository.listQuestionsByTaskId(taskId),
        dependencies.taskContextRepository.getByTaskId(taskId),
        dependencies.agentSessionRepository.getByTaskId(taskId),
        dependencies.taskLinkRepository.listByTaskId(taskId),
        dependencies.taskResourceRepository.listByTaskId(taskId)
      ]);

    return {
      project,
      task,
      plan,
      planRevisions,
      planComments,
      planQuestions,
      taskContext,
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
    async addPlanQuestion(input) {
      const parsedInput = addPlanQuestionInputSchema.parse(input);
      const detail = await getTaskDetail(parsedInput.taskId);

      if (!detail.plan) {
        throw new Error("Сначала создайте или сохраните базовый план, затем добавляйте вопросы.");
      }

      const question = await dependencies.planCommentRepository.addQuestion({
        planId: detail.plan.id,
        taskId: parsedInput.taskId,
        content: parsedInput.content
      });
      emitDataChanged({
        reason: "add-plan-question",
        projectId: detail.task.projectId,
        taskId: parsedInput.taskId
      });

      return question;
    },
    async answerPlanQuestion(input) {
      const parsedInput = answerPlanQuestionInputSchema.parse(input);
      const question = await dependencies.planCommentRepository.getQuestionById(parsedInput.questionId);

      if (!question || question.taskId !== parsedInput.taskId) {
        throw new Error(`Вопрос ${parsedInput.questionId} для задачи ${parsedInput.taskId} не найден.`);
      }

      const answered = await dependencies.planCommentRepository.answerQuestion(
        parsedInput.questionId,
        parsedInput.answer
      );
      const detail = await getTaskDetail(parsedInput.taskId);
      emitDataChanged({
        reason: "answer-plan-question",
        projectId: detail.task.projectId,
        taskId: parsedInput.taskId
      });

      return answered;
    },
    async appendPlanExtension(input) {
      const parsedInput = appendPlanExtensionInputSchema.parse(input);
      const detail = await getTaskDetail(parsedInput.taskId);

      if (!detail.plan) {
        throw new Error("Сначала создайте или сохраните базовый план, затем добавляйте его расширения.");
      }

      const comment = await dependencies.planCommentRepository.addComment({
        planId: detail.plan.id,
        taskId: parsedInput.taskId,
        kind: "extension",
        author: parsedInput.author ?? "human",
        content: parsedInput.content
      });
      emitDataChanged({
        reason: "add-plan-comment",
        projectId: detail.task.projectId,
        taskId: parsedInput.taskId
      });

      return comment;
    },
    async appendPlanImprovement(input) {
      const parsedInput = appendPlanImprovementInputSchema.parse(input);
      const detail = await getTaskDetail(parsedInput.taskId);

      if (!detail.plan) {
        throw new Error("Сначала создайте или сохраните базовый план, затем добавляйте его доработки.");
      }

      const comment = await dependencies.planCommentRepository.addComment({
        planId: detail.plan.id,
        taskId: parsedInput.taskId,
        kind: "improvement",
        author: parsedInput.author ?? "human",
        content: parsedInput.content
      });
      emitDataChanged({
        reason: "add-plan-comment",
        projectId: detail.task.projectId,
        taskId: parsedInput.taskId
      });

      return comment;
    },
    async consolidatePlanDiscussion(input) {
      const parsedInput = consolidatePlanDiscussionInputSchema.parse(input);
      const detail = await getTaskDetail(parsedInput.taskId);
      const nextBaseContentMd = extractBasePlanContent(parsedInput.contentMd);

      const savedPlan = await dependencies.planRepository.save({
        taskId: parsedInput.taskId,
        contentMd: nextBaseContentMd,
        createRevision: parsedInput.source === "agent",
        source: parsedInput.source
      });

      // Удаляем все комментарии и открытые вопросы — они поглощены новым планом
      await dependencies.planCommentRepository.deleteCommentsByPlanId(savedPlan.id);
      await dependencies.planCommentRepository.deleteOpenQuestionsByPlanId(savedPlan.id);

      // Добавляем новые открытые вопросы если переданы
      if (parsedInput.openQuestions?.length) {
        for (const content of parsedInput.openQuestions) {
          await dependencies.planCommentRepository.addQuestion({
            planId: savedPlan.id,
            taskId: parsedInput.taskId,
            content
          });
        }
      }

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
      const nextBaseContentMd = extractBasePlanContent(parsedInput.contentMd);

      const savedPlan = await dependencies.planRepository.save({
        taskId: parsedInput.taskId,
        contentMd: nextBaseContentMd,
        createRevision: parsedInput.source === "agent",
        source: parsedInput.source
      });

      // Если переданы openQuestions — заменяем открытые вопросы
      if (parsedInput.openQuestions !== undefined) {
        await dependencies.planCommentRepository.deleteOpenQuestionsByPlanId(savedPlan.id);

        for (const content of parsedInput.openQuestions) {
          await dependencies.planCommentRepository.addQuestion({
            planId: savedPlan.id,
            taskId: parsedInput.taskId,
            content
          });
        }
      }

      if (hasTaskContextPatch(parsedInput)) {
        const nextTaskContext = mergeTaskContext(detail.taskContext, parsedInput);
        await dependencies.taskContextRepository.replaceByTaskId(parsedInput.taskId, nextTaskContext);
      }

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
