/*
Назначение: Описывает общие доменные модели, схемы валидации и preload-контракт десктопного приложения, включая операции с задачами, планом, обсуждением и статусами.
Не входит: Реализация репозиториев, детали renderer-компонентов и интеграция с внешними SDK.
*/
import { z } from "zod";

export const agentProviderIdSchema = z.enum(["mcp"]);
export type AgentProviderId = z.infer<typeof agentProviderIdSchema>;

export const taskStatusSchema = z.enum([
  "new",
  "planning",
  "requires_clarification",
  "implementation",
  "completed"
]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const planSourceSchema = z.enum(["human", "agent"]);
export type PlanSource = z.infer<typeof planSourceSchema>;

export const planDiscussionAuthorSchema = z.enum(["human", "agent"]);
export type PlanDiscussionAuthor = z.infer<typeof planDiscussionAuthorSchema>;

export const agentSessionStatusSchema = z.enum(["idle", "running", "completed", "failed"]);
export type AgentSessionStatus = z.infer<typeof agentSessionStatusSchema>;

export const projectRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  rootPath: z.string().nullable(),
  languages: z.array(z.string()),
  skillFilePath: z.string().nullable(),
  skillPrompt: z.string(),
  isProfileComplete: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type ProjectRecord = z.infer<typeof projectRecordSchema>;

export const taskRecordSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  title: z.string(),
  description: z.string(),
  status: taskStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string()
});
export type TaskRecord = z.infer<typeof taskRecordSchema>;

export const planRecordSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  contentMd: z.string(),
  source: planSourceSchema,
  createdAt: z.string(),
  updatedAt: z.string()
});
export type PlanRecord = z.infer<typeof planRecordSchema>;

export const planRevisionRecordSchema = z.object({
  id: z.string(),
  planId: z.string(),
  taskId: z.string(),
  contentMd: z.string(),
  source: planSourceSchema,
  createdAt: z.string()
});
export type PlanRevisionRecord = z.infer<typeof planRevisionRecordSchema>;

export const agentSessionRecordSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  provider: agentProviderIdSchema,
  externalSessionId: z.string().nullable(),
  externalThreadId: z.string().nullable(),
  status: agentSessionStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string()
});
export type AgentSessionRecord = z.infer<typeof agentSessionRecordSchema>;

export const taskDetailSchema = z.object({
  project: projectRecordSchema,
  task: taskRecordSchema,
  plan: planRecordSchema.nullable(),
  planRevisions: z.array(planRevisionRecordSchema),
  agentSession: agentSessionRecordSchema.nullable()
});
export type TaskDetail = z.infer<typeof taskDetailSchema>;

export const appHealthSnapshotSchema = z.object({
  appName: z.string(),
  databasePath: z.string(),
  platform: z.string(),
  agentProviders: z.array(agentProviderIdSchema),
  mcpEndpoint: z.string().nullable(),
  mcpServerRunning: z.boolean()
});
export type AppHealthSnapshot = z.infer<typeof appHealthSnapshotSchema>;

export const createTaskInputSchema = z.object({
  title: z.string().trim().min(3, "Введите минимум 3 символа в заголовке.").max(120),
  description: z.string().trim().min(12, "Опишите задачу хотя бы в 12 символах."),
  projectId: z.string().trim().min(1).optional(),
  projectName: z.string().trim().min(2, "Укажите проект минимум из 2 символов.").max(80).optional()
}).superRefine((value, context) => {
  if (value.projectId || value.projectName) {
    return;
  }

  context.addIssue({
    code: "custom",
    path: ["projectName"],
    message: "Выберите существующий проект или укажите новый."
  });
});
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

export const createProjectInputSchema = z.object({
  name: z.string().trim().min(2, "Укажите название проекта минимум из 2 символов.").max(80)
});
export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;

export const updateProjectProfileInputSchema = z
  .object({
    projectId: z.string(),
    name: z.string().trim().min(2, "Укажите название проекта минимум из 2 символов.").max(80).optional(),
    description: z.string().trim().max(4_000).optional(),
    rootPath: z.string().trim().min(1, "Укажите путь к проекту.").max(500).nullable().optional(),
    languages: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    skillFilePath: z
      .string()
      .trim()
      .min(1, "Укажите путь к skill-файлу.")
      .max(500)
      .nullable()
      .optional(),
    skillPrompt: z.string().trim().max(4_000).optional()
  })
  .superRefine((value, context) => {
    const hasChanges =
      value.name !== undefined ||
      value.description !== undefined ||
      value.rootPath !== undefined ||
      value.languages !== undefined ||
      value.skillFilePath !== undefined ||
      value.skillPrompt !== undefined;

    if (hasChanges) {
      return;
    }

    context.addIssue({
      code: "custom",
      path: ["projectId"],
      message: "Передайте хотя бы одно поле для обновления проекта."
    });
  });
export type UpdateProjectProfileInput = z.infer<typeof updateProjectProfileInputSchema>;

export const savePlanInputSchema = z.object({
  taskId: z.string(),
  contentMd: z.string().trim().min(1, "План не может быть пустым."),
  openQuestions: z.array(z.string().trim().min(1).max(4_000)).max(50).optional(),
  source: planSourceSchema.default("human")
});
export type SavePlanInput = z.infer<typeof savePlanInputSchema>;

export const appendPlanExtensionInputSchema = z.object({
  taskId: z.string(),
  content: z.string().trim().min(1).max(4_000),
  author: planDiscussionAuthorSchema.default("human")
});
export type AppendPlanExtensionInput = z.infer<typeof appendPlanExtensionInputSchema>;

export const appendPlanImprovementInputSchema = z.object({
  taskId: z.string(),
  content: z.string().trim().min(1).max(4_000),
  author: planDiscussionAuthorSchema.default("human")
});
export type AppendPlanImprovementInput = z.infer<typeof appendPlanImprovementInputSchema>;

export const consolidatePlanDiscussionInputSchema = z.object({
  taskId: z.string(),
  contentMd: z.string().trim().min(1, "План не может быть пустым."),
  openQuestions: z.array(z.string().trim().min(1).max(4_000)).max(50).optional(),
  source: planSourceSchema.default("agent")
});
export type ConsolidatePlanDiscussionInput = z.infer<typeof consolidatePlanDiscussionInputSchema>;

export const answerPlanQuestionInputSchema = z.object({
  taskId: z.string(),
  questionId: z.string(),
  answer: z.string().trim().min(1).max(4_000)
});
export type AnswerPlanQuestionInput = z.infer<typeof answerPlanQuestionInputSchema>;

export const deleteTaskResultSchema = z.object({
  deletedTaskId: z.string()
});
export type DeleteTaskResult = z.infer<typeof deleteTaskResultSchema>;

export const updateTaskStatusInputSchema = z.object({
  taskId: z.string(),
  status: taskStatusSchema
});
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusInputSchema>;

export const restorePlanRevisionInputSchema = z.object({
  revisionId: z.string(),
  taskId: z.string()
});
export type RestorePlanRevisionInput = z.infer<typeof restorePlanRevisionInputSchema>;

export const desktopDataChangeEventSchema = z.object({
  projectId: z.string().nullable(),
  reason: z.enum([
    "append-plan-extension",
    "append-plan-improvement",
    "answer-plan-question",
    "consolidate-plan-discussion",
    "create-project",
    "create-task",
    "delete-task",
    "restore-plan-revision",
    "save-plan",
    "update-project-profile",
    "update-task-status"
  ]),
  taskId: z.string().nullable()
});
export type DesktopDataChangeEvent = z.infer<typeof desktopDataChangeEventSchema>;

export interface DesktopApi {
  appendPlanExtension(input: AppendPlanExtensionInput): Promise<TaskDetail>;
  appendPlanImprovement(input: AppendPlanImprovementInput): Promise<TaskDetail>;
  answerPlanQuestion(input: AnswerPlanQuestionInput): Promise<TaskDetail>;
  consolidatePlanDiscussion(input: ConsolidatePlanDiscussionInput): Promise<TaskDetail>;
  createProject(input: CreateProjectInput): Promise<ProjectRecord>;
  createTask(input: CreateTaskInput): Promise<TaskDetail>;
  deleteTask(taskId: string): Promise<DeleteTaskResult>;
  getHealth(): Promise<AppHealthSnapshot>;
  getProject(projectId: string): Promise<ProjectRecord | null>;
  getTaskDetail(taskId: string): Promise<TaskDetail>;
  listProjects(): Promise<ProjectRecord[]>;
  listTasks(): Promise<TaskRecord[]>;
  onDataChanged(listener: (event: DesktopDataChangeEvent) => void): () => void;
  onFocusTask(listener: (taskId: string) => void): () => void;
  restorePlanRevision(input: RestorePlanRevisionInput): Promise<TaskDetail>;
  savePlan(input: SavePlanInput): Promise<TaskDetail>;
  updateProjectProfile(input: UpdateProjectProfileInput): Promise<ProjectRecord>;
  updateTaskStatus(input: UpdateTaskStatusInput): Promise<TaskDetail>;
}
