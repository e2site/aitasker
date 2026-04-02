/*
Назначение: Facade над единой сущностью "задача" — предоставляет единую точку доступа к task, plan, task context, planComments, planQuestions, linkedResources и linkedTasks, скрывая внутренние сущности AppService.
Не входит: Регистрация MCP-инструментов, HTTP-транспорт, сериализация MCP-ответов.
*/
import type {
  LinkedResourceRecord,
  LinkedTaskRecord,
  PlanCommentRecord,
  PlanQuestionRecord,
  PlanRecord,
  PlanRevisionRecord,
  ResourceRecord,
  TaskContextRecord,
  TaskDetail,
  TaskRecord,
  TaskStatus
} from "../../shared/contracts/desktop-api";
import type { AppService } from "./app-service";

export class TaskContext {
  private readonly taskId: string;
  private readonly appService: AppService;

  private _detail: TaskDetail | null = null;
  private _resourceCache = new Map<string, ResourceRecord>();

  constructor(taskId: string, appService: AppService) {
    this.taskId = taskId;
    this.appService = appService;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async detail(): Promise<TaskDetail> {
    if (!this._detail) {
      this._detail = await this.appService.getTaskDetail(this.taskId);
    }

    return this._detail;
  }

  private invalidate() {
    this._detail = null;
  }

  private normalizeTaskContextList(items: string[] | undefined): string[] | undefined {
    if (items === undefined) {
      return undefined;
    }

    const normalized: string[] = [];
    const seen = new Set<string>();

    for (const item of items) {
      const value = item.trim();

      if (value.length === 0 || seen.has(value)) {
        continue;
      }

      seen.add(value);
      normalized.push(value);
    }

    return normalized;
  }

  private normalizeTaskContextInput(input?: TaskContextSaveInput): TaskContextSaveInput | undefined {
    if (!input) {
      return undefined;
    }

    const goal = this.normalizeTaskContextList(input.goal);
    const criticalConditions = this.normalizeTaskContextList(input.criticalConditions);
    const forbiddenInterpretations = this.normalizeTaskContextList(input.forbiddenInterpretations);
    const acceptanceCriteria = this.normalizeTaskContextList(input.acceptanceCriteria);

    if (
      goal === undefined &&
      criticalConditions === undefined &&
      forbiddenInterpretations === undefined &&
      acceptanceCriteria === undefined
    ) {
      return undefined;
    }

    return {
      goal,
      criticalConditions,
      forbiddenInterpretations,
      acceptanceCriteria
    };
  }

  private mergeTaskContext(
    current: TaskContextRecord,
    input: TaskContextSaveInput | undefined
  ): TaskContextRecord | undefined {
    if (!input) {
      return undefined;
    }

    return {
      goal: input.goal ?? current.goal,
      criticalConditions: input.criticalConditions ?? current.criticalConditions,
      forbiddenInterpretations: input.forbiddenInterpretations ?? current.forbiddenInterpretations,
      acceptanceCriteria: input.acceptanceCriteria ?? current.acceptanceCriteria
    };
  }

  // ─── Task ────────────────────────────────────────────────────────────────────

  async getTask(): Promise<TaskRecord> {
    return (await this.detail()).task;
  }

  async updateStatus(status: TaskStatus): Promise<void> {
    await this.appService.updateTaskStatus({ taskId: this.taskId, status });
    this.invalidate();
  }

  // ─── Plan ────────────────────────────────────────────────────────────────────

  async getPlan(): Promise<PlanRecord | null> {
    return (await this.detail()).plan;
  }

  async savePlan(
    contentMd: string,
    openQuestions?: string[],
    source: "human" | "agent" = "agent",
    taskContext?: TaskContextSaveInput
  ): Promise<void> {
    const detail = await this.detail();
    const normalizedTaskContext = this.normalizeTaskContextInput(taskContext);
    const mergedTaskContext = this.mergeTaskContext(detail.taskContext, normalizedTaskContext);

    await this.appService.savePlan({
      taskId: this.taskId,
      contentMd,
      openQuestions,
      source,
      goal: mergedTaskContext?.goal,
      criticalConditions: mergedTaskContext?.criticalConditions,
      forbiddenInterpretations: mergedTaskContext?.forbiddenInterpretations,
      acceptanceCriteria: mergedTaskContext?.acceptanceCriteria
    });
    this.invalidate();
  }

  async appendExtension(content: string, author: "human" | "agent" = "agent"): Promise<void> {
    await this.appService.appendPlanExtension({ taskId: this.taskId, content, author });
    this.invalidate();
  }

  async appendImprovement(content: string, author: "human" | "agent" = "agent"): Promise<void> {
    await this.appService.appendPlanImprovement({ taskId: this.taskId, content, author });
    this.invalidate();
  }

  async consolidateDiscussion(
    contentMd: string,
    openQuestions?: string[],
    source: "human" | "agent" = "agent"
  ): Promise<void> {
    await this.appService.consolidatePlanDiscussion({
      taskId: this.taskId,
      contentMd,
      openQuestions,
      source
    });
    this.invalidate();
  }

  // ─── Plan comments ────────────────────────────────────────────────────────────

  async getPlanComments(): Promise<PlanCommentRecord[]> {
    return (await this.detail()).planComments;
  }

  async getComment(commentId: string): Promise<PlanCommentRecord> {
    const comments = await this.getPlanComments();
    const item = comments.find((c) => c.id === commentId);

    if (!item) throw new Error(`Комментарий ${commentId} для задачи ${this.taskId} не найден.`);

    return item;
  }

  // ─── Plan questions ───────────────────────────────────────────────────────────

  async getPlanQuestions(): Promise<PlanQuestionRecord[]> {
    return (await this.detail()).planQuestions;
  }

  async getTaskContext(): Promise<TaskContextRecord> {
    return (await this.detail()).taskContext;
  }

  async getQuestion(questionId: string): Promise<PlanQuestionRecord> {
    const questions = await this.getPlanQuestions();
    const item = questions.find((q) => q.id === questionId);

    if (!item) throw new Error(`Вопрос ${questionId} для задачи ${this.taskId} не найден.`);

    return item;
  }

  async addQuestion(content: string): Promise<void> {
    await this.appService.addPlanQuestion({ taskId: this.taskId, content });
    this.invalidate();
  }

  async answerQuestion(questionId: string, answer: string): Promise<void> {
    await this.appService.answerPlanQuestion({ taskId: this.taskId, questionId, answer });
    this.invalidate();
  }

  // ─── Plan revisions (read, не попадают в MCP snapshot) ───────────────────────

  async getPlanRevisions(): Promise<PlanRevisionRecord[]> {
    return (await this.detail()).planRevisions;
  }

  // ─── Linked resources (read) ─────────────────────────────────────────────────

  async getLinkedResources(): Promise<LinkedResourceRecord[]> {
    return (await this.detail()).linkedResources;
  }

  async getResource(resourceId: string): Promise<ResourceRecord> {
    if (!this._resourceCache.has(resourceId)) {
      const resource = await this.appService.getResource(resourceId);
      this._resourceCache.set(resourceId, resource);
    }

    return this._resourceCache.get(resourceId)!;
  }

  // ─── Linked tasks (read) ─────────────────────────────────────────────────────

  async getLinkedTasks(): Promise<LinkedTaskRecord[]> {
    return (await this.detail()).linkedTasks;
  }

  // ─── Snapshot ────────────────────────────────────────────────────────────────

  async getSnapshot(): Promise<TaskContextSnapshot> {
    const detail = await this.detail();

    return {
      task: detail.task,
      plan: detail.plan,
      planComments: detail.planComments,
      planQuestions: detail.planQuestions,
      taskContext: detail.taskContext,
      linkedResources: detail.linkedResources,
      linkedTasks: detail.linkedTasks,
      project: detail.project
    };
  }
}

export interface TaskContextSnapshot {
  task: TaskDetail["task"];
  plan: TaskDetail["plan"];
  planComments: TaskDetail["planComments"];
  planQuestions: TaskDetail["planQuestions"];
  taskContext: TaskDetail["taskContext"];
  linkedResources: TaskDetail["linkedResources"];
  linkedTasks: TaskDetail["linkedTasks"];
  project: TaskDetail["project"];
}

export interface TaskContextSaveInput {
  goal?: string[];
  criticalConditions?: string[];
  forbiddenInterpretations?: string[];
  acceptanceCriteria?: string[];
}

export function createTaskContext(taskId: string, appService: AppService): TaskContext {
  return new TaskContext(taskId, appService);
}
