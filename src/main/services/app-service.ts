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
  CreateTaskInput,
  DesktopDataChangeEvent,
  DeleteTaskResult,
  ProjectRecord,
  RestorePlanRevisionInput,
  SavePlanInput,
  TaskDetail,
  TaskRecord,
  TaskStatus,
  UpdateTaskStatusInput,
  UpdateProjectProfileInput
} from "../../shared/contracts/desktop-api";
import {
  answerPlanQuestionInputSchema,
  appendPlanExtensionInputSchema,
  appendPlanImprovementInputSchema,
  consolidatePlanDiscussionInputSchema,
  createProjectInputSchema,
  createTaskInputSchema,
  restorePlanRevisionInputSchema,
  savePlanInputSchema,
  updateTaskStatusInputSchema,
  updateProjectProfileInputSchema
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
import type { ProjectRepository } from "../db/project-repository";
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
  taskRepository: TaskRepository;
}

export interface AppService {
  answerPlanQuestion(input: AnswerPlanQuestionInput): Promise<TaskDetail>;
  appendPlanExtension(input: AppendPlanExtensionInput): Promise<TaskDetail>;
  appendPlanImprovement(input: AppendPlanImprovementInput): Promise<TaskDetail>;
  consolidatePlanDiscussion(input: ConsolidatePlanDiscussionInput): Promise<TaskDetail>;
  createProject(input: CreateProjectInput): Promise<ProjectRecord>;
  createTask(input: CreateTaskInput): Promise<TaskDetail>;
  deleteTask(taskId: string): Promise<DeleteTaskResult>;
  getHealthSnapshot(): AppHealthSnapshot;
  getProject(projectId: string): Promise<ProjectRecord | null>;
  getTaskDetail(taskId: string, projectId?: string): Promise<TaskDetail>;
  listProjects(): Promise<ProjectRecord[]>;
  listTasks(projectId?: string): Promise<TaskRecord[]>;
  restorePlanRevision(input: RestorePlanRevisionInput): Promise<TaskDetail>;
  savePlan(input: SavePlanInput): Promise<TaskDetail>;
  updateTaskStatus(input: UpdateTaskStatusInput): Promise<TaskDetail>;
  updateProjectProfile(input: UpdateProjectProfileInput): Promise<ProjectRecord>;
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

    const [plan, planRevisions, agentSession] = await Promise.all([
      dependencies.planRepository.getByTaskId(taskId),
      dependencies.planRepository.listRevisions(taskId),
      dependencies.agentSessionRepository.getByTaskId(taskId)
    ]);

    return {
      project,
      task,
      plan,
      planRevisions,
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
    }
  };
}
