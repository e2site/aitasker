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
  "testing",
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

export const resourceRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  contentMd: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type ResourceRecord = z.infer<typeof resourceRecordSchema>;

export const linkedResourceRecordSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  name: z.string(),
  contentMd: z.string(),
  comment: z.string(),
  createdAt: z.string()
});
export type LinkedResourceRecord = z.infer<typeof linkedResourceRecordSchema>;

export const linkedTaskRecordSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  title: z.string(),
  status: taskStatusSchema,
  projectName: z.string(),
  comment: z.string(),
  direction: z.enum(["outgoing", "incoming"]),
  createdAt: z.string()
});
export type LinkedTaskRecord = z.infer<typeof linkedTaskRecordSchema>;

export const taskDetailSchema = z.object({
  project: projectRecordSchema,
  task: taskRecordSchema,
  plan: planRecordSchema.nullable(),
  planRevisions: z.array(planRevisionRecordSchema),
  agentSession: agentSessionRecordSchema.nullable(),
  linkedTasks: z.array(linkedTaskRecordSchema),
  linkedResources: z.array(linkedResourceRecordSchema)
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

export const createResourceInputSchema = z.object({
  name: z.string().trim().min(1, "Введите название ресурса.").max(200),
  contentMd: z.string().optional()
});
export type CreateResourceInput = z.infer<typeof createResourceInputSchema>;

export const updateResourceInputSchema = z
  .object({
    id: z.string(),
    name: z.string().trim().min(1, "Введите название ресурса.").max(200).optional(),
    contentMd: z.string().optional()
  })
  .refine((v) => v.name !== undefined || v.contentMd !== undefined, {
    message: "Передайте хотя бы одно поле для обновления ресурса."
  });
export type UpdateResourceInput = z.infer<typeof updateResourceInputSchema>;

export const linkResourceInputSchema = z.object({
  taskId: z.string(),
  resourceId: z.string(),
  comment: z.string().max(500).default("")
});
export type LinkResourceInput = z.infer<typeof linkResourceInputSchema>;

export const unlinkResourceInputSchema = z.object({
  linkId: z.string(),
  taskId: z.string()
});
export type UnlinkResourceInput = z.infer<typeof unlinkResourceInputSchema>;

export const deleteTaskResultSchema = z.object({
  deletedTaskId: z.string()
});
export type DeleteTaskResult = z.infer<typeof deleteTaskResultSchema>;

export const updateTaskStatusInputSchema = z.object({
  taskId: z.string(),
  status: taskStatusSchema
});
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusInputSchema>;

export const updateTaskInputSchema = z.object({
  taskId: z.string(),
  title: z.string().trim().min(3, "Введите минимум 3 символа.").max(120).optional(),
  description: z.string().trim().min(12, "Опишите задачу хотя бы в 12 символах.").optional()
}).refine(
  (v) => v.title !== undefined || v.description !== undefined,
  { message: "Передайте хотя бы одно поле для обновления задачи." }
);
export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;

export const restorePlanRevisionInputSchema = z.object({
  revisionId: z.string(),
  taskId: z.string()
});
export type RestorePlanRevisionInput = z.infer<typeof restorePlanRevisionInputSchema>;

export const linkTaskInputSchema = z.object({
  sourceTaskId: z.string(),
  targetTaskId: z.string(),
  comment: z.string().max(500).default("")
}).refine(
  (v) => v.sourceTaskId !== v.targetTaskId,
  { message: "Нельзя привязать задачу к самой себе." }
);
export type LinkTaskInput = z.infer<typeof linkTaskInputSchema>;

export const unlinkTaskInputSchema = z.object({
  linkId: z.string(),
  taskId: z.string()
});
export type UnlinkTaskInput = z.infer<typeof unlinkTaskInputSchema>;

export const promptOverrideRecordSchema = z.object({
  id: z.string(),
  template: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type PromptOverrideRecord = z.infer<typeof promptOverrideRecordSchema>;

export const upsertPromptOverrideInputSchema = z.object({
  id: z.string().min(1),
  template: z.string().min(1, "Шаблон не может быть пустым.").max(8_000)
});
export type UpsertPromptOverrideInput = z.infer<typeof upsertPromptOverrideInputSchema>;

export const deletePromptOverrideInputSchema = z.object({
  id: z.string().min(1)
});
export type DeletePromptOverrideInput = z.infer<typeof deletePromptOverrideInputSchema>;

export const desktopDataChangeEventSchema = z.object({
  projectId: z.string().nullable(),
  reason: z.enum([
    "append-plan-extension",
    "append-plan-improvement",
    "answer-plan-question",
    "consolidate-plan-discussion",
    "create-project",
    "create-resource",
    "create-task",
    "delete-resource",
    "delete-task",
    "link-resource",
    "link-task",
    "restore-plan-revision",
    "save-plan",
    "unlink-resource",
    "unlink-task",
    "update-project-profile",
    "update-resource",
    "update-task",
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
  createResource(input: CreateResourceInput): Promise<ResourceRecord>;
  createTask(input: CreateTaskInput): Promise<TaskDetail>;
  deletePromptOverride(input: DeletePromptOverrideInput): Promise<void>;
  deleteResource(id: string): Promise<void>;
  deleteTask(taskId: string): Promise<DeleteTaskResult>;
  exportData(): Promise<{ filePath: string } | null>;
  getHealth(): Promise<AppHealthSnapshot>;
  getProject(projectId: string): Promise<ProjectRecord | null>;
  getResource(id: string): Promise<ResourceRecord>;
  getTaskDetail(taskId: string): Promise<TaskDetail>;
  importData(): Promise<void>;
  linkResource(input: LinkResourceInput): Promise<TaskDetail>;
  linkTask(input: LinkTaskInput): Promise<TaskDetail>;
  listPromptOverrides(): Promise<PromptOverrideRecord[]>;
  listProjects(): Promise<ProjectRecord[]>;
  listResources(): Promise<ResourceRecord[]>;
  listTasks(): Promise<TaskRecord[]>;
  onDataChanged(listener: (event: DesktopDataChangeEvent) => void): () => void;
  onFocusTask(listener: (taskId: string) => void): () => void;
  restorePlanRevision(input: RestorePlanRevisionInput): Promise<TaskDetail>;
  savePlan(input: SavePlanInput): Promise<TaskDetail>;
  unlinkResource(input: UnlinkResourceInput): Promise<TaskDetail>;
  unlinkTask(input: UnlinkTaskInput): Promise<TaskDetail>;
  updateProjectProfile(input: UpdateProjectProfileInput): Promise<ProjectRecord>;
  updateResource(input: UpdateResourceInput): Promise<ResourceRecord>;
  updateTask(input: UpdateTaskInput): Promise<TaskDetail>;
  updateTaskStatus(input: UpdateTaskStatusInput): Promise<TaskDetail>;
  upsertPromptOverride(input: UpsertPromptOverrideInput): Promise<PromptOverrideRecord>;
}
