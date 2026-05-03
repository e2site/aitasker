/*
Назначение: Формирует компактные внешние ответы MCP из внутренних доменных моделей приложения, включая проекты, задачи, ресурсы и подсказки.
Не входит: Регистрация MCP-инструментов, бизнес-логика сервисов и desktop-контракты renderer.
*/
import type { AppService } from "../services/app-service";
import type { AgentSession } from "./agent-session";
import type { TaskContextSnapshot } from "../services/task-context";
import type {
  PlanCommentRecord,
  PlanQuestionRecord,
  PromptHintRecord,
  PromptHintSearchResult,
  TaskContextRecord
} from "../../shared/contracts/desktop-api";

export type { AgentSession };

type ProjectRecord = Awaited<ReturnType<AppService["listProjects"]>>[number];
type ResourceRecord = Awaited<ReturnType<AppService["listResources"]>>[number];
type TaskDetail = Awaited<ReturnType<AppService["getTaskDetail"]>>;
type TaskRecord = Awaited<ReturnType<AppService["listTasks"]>>[number];

function serializeProjectSummary(project: ProjectRecord) {
  return {
    id: project.id,
    isProfileComplete: project.isProfileComplete,
    name: project.name
  };
}

export function serializeActiveProject(project: ProjectRecord) {
  return {
    description: project.description,
    id: project.id,
    isProfileComplete: project.isProfileComplete,
    languages: project.languages,
    name: project.name,
    rootPath: project.rootPath,
    skillFilePath: project.skillFilePath
  };
}

export function serializeProjectCollection(projects: ProjectRecord[], activeProjectId: string | null) {
  return {
    activeProjectId,
    projects: projects.map(serializeProjectSummary)
  };
}

export function serializeActivatedProject(project: ProjectRecord) {
  return {
    activeProjectId: project.id,
    project: serializeProjectSummary(project)
  };
}

export function serializeTask(task: TaskRecord) {
  return {
    description: task.description,
    id: task.id,
    projectId: task.projectId,
    projectName: task.projectName,
    status: task.status,
    title: task.title,
    updatedAt: task.updatedAt
  };
}

function serializeLinkedTask(link: TaskDetail["linkedTasks"][number]) {
  return {
    comment: link.comment,
    direction: link.direction,
    projectName: link.projectName,
    status: link.status,
    taskId: link.taskId,
    title: link.title
  };
}

function serializeLinkedResource(link: TaskDetail["linkedResources"][number]) {
  return {
    comment: link.comment,
    name: link.name,
    readHint: `Для чтения содержимого вызови get_resource с id "${link.resourceId}".`,
    resourceId: link.resourceId
  };
}

function serializePlanComment(comment: PlanCommentRecord) {
  return {
    author: comment.author,
    content: comment.content,
    id: comment.id,
    kind: comment.kind,
    updatedAt: comment.updatedAt
  };
}

function serializePlanQuestion(question: PlanQuestionRecord) {
  return {
    answer: question.answer,
    answeredAt: question.answeredAt,
    content: question.content,
    id: question.id,
    updatedAt: question.updatedAt
  };
}

function serializePlanBlock(
  plan: TaskDetail["plan"],
  comments: PlanCommentRecord[],
  questions: PlanQuestionRecord[],
  taskContext: TaskContextRecord
) {
  if (!plan) {
    return {
      exists: false,
      contentMd: "",
      comments: [],
      questions: [],
      goal: taskContext.goal,
      criticalConditions: taskContext.criticalConditions,
      forbiddenInterpretations: taskContext.forbiddenInterpretations,
      acceptanceCriteria: taskContext.acceptanceCriteria
    };
  }

  return {
    exists: true,
    contentMd: plan.contentMd,
    source: plan.source,
    updatedAt: plan.updatedAt,
    comments: comments.map(serializePlanComment),
    questions: questions.map(serializePlanQuestion),
    goal: taskContext.goal,
    criticalConditions: taskContext.criticalConditions,
    forbiddenInterpretations: taskContext.forbiddenInterpretations,
    acceptanceCriteria: taskContext.acceptanceCriteria
  };
}

export function serializePlan(plan: TaskDetail["plan"], taskId: string, taskContext: TaskContextRecord) {
  if (!plan) {
    return {
      contentMd: "",
      exists: false,
      taskId,
      goal: taskContext.goal,
      criticalConditions: taskContext.criticalConditions,
      forbiddenInterpretations: taskContext.forbiddenInterpretations,
      acceptanceCriteria: taskContext.acceptanceCriteria
    };
  }

  return {
    contentMd: plan.contentMd,
    exists: true,
    source: plan.source,
    taskId,
    updatedAt: plan.updatedAt,
    goal: taskContext.goal,
    criticalConditions: taskContext.criticalConditions,
    forbiddenInterpretations: taskContext.forbiddenInterpretations,
    acceptanceCriteria: taskContext.acceptanceCriteria
  };
}

export function serializeTaskDetail(detail: TaskDetail) {
  return {
    linkedResources: detail.linkedResources.map(serializeLinkedResource),
    linkedTasks: detail.linkedTasks.map(serializeLinkedTask),
    plan: serializePlanBlock(detail.plan, detail.planComments, detail.planQuestions, detail.taskContext),
    project: serializeProjectSummary(detail.project),
    task: serializeTask(detail.task)
  };
}

export function serializeTaskCollection(tasks: TaskRecord[], project?: ProjectRecord) {
  return {
    project: project ? serializeProjectSummary(project) : null,
    tasks: tasks.map(serializeTask)
  };
}

export function serializeResource(resource: ResourceRecord) {
  return {
    contentMd: resource.contentMd,
    id: resource.id,
    name: resource.name
  };
}

export function serializeResourceCollection(resources: ResourceRecord[]) {
  return {
    resources: resources.map(serializeResource)
  };
}

export function serializePromptHint(hint: PromptHintRecord) {
  return {
    id: hint.id,
    projectId: hint.projectId,
    text: hint.text,
    updatedAt: hint.updatedAt
  };
}

export function serializePromptHintCollection(hints: PromptHintRecord[], project: ProjectRecord) {
  return {
    project: serializeProjectSummary(project),
    hints: hints.map(serializePromptHint)
  };
}

export function serializePromptHintSearchCollection(
  hints: PromptHintSearchResult[],
  project: ProjectRecord,
  keywords: string[]
) {
  return {
    project: serializeProjectSummary(project),
    keywords,
    hints: hints.map((hint) => ({
      ...serializePromptHint(hint),
      score: hint.score
    }))
  };
}

export function serializeTaskSnapshot(snapshot: TaskContextSnapshot) {
  return {
    task: serializeTask(snapshot.task),
    project: serializeProjectSummary(snapshot.project),
    plan: serializePlanBlock(
      snapshot.plan,
      snapshot.planComments,
      snapshot.planQuestions,
      snapshot.taskContext
    ),
    linkedResources: snapshot.linkedResources.map(serializeLinkedResource),
    linkedTasks: snapshot.linkedTasks.map(serializeLinkedTask)
  };
}

const UNCHANGED = { unchanged: true } as const;

export function serializeDeltaSnapshot(snapshot: TaskContextSnapshot, since: number) {
  const sinceDate = new Date(since).toISOString();

  const taskUpdated = new Date(snapshot.task.updatedAt).getTime() > since;
  const task = taskUpdated ? serializeTask(snapshot.task) : UNCHANGED;

  const planUpdated = snapshot.plan !== null && new Date(snapshot.plan.updatedAt).getTime() > since;
  const newComments = snapshot.planComments.filter((c) => new Date(c.updatedAt).getTime() > since);
  const newQuestions = snapshot.planQuestions.filter((q) => new Date(q.updatedAt).getTime() > since);
  const plan =
    planUpdated || newComments.length > 0 || newQuestions.length > 0
      ? {
          ...(planUpdated && snapshot.plan
            ? {
                contentMd: snapshot.plan.contentMd,
                updatedAt: snapshot.plan.updatedAt,
                goal: snapshot.taskContext.goal,
                criticalConditions: snapshot.taskContext.criticalConditions,
                forbiddenInterpretations: snapshot.taskContext.forbiddenInterpretations,
                acceptanceCriteria: snapshot.taskContext.acceptanceCriteria
              }
            : UNCHANGED),
          comments: newComments.length > 0 ? newComments.map(serializePlanComment) : UNCHANGED,
          questions: newQuestions.length > 0 ? newQuestions.map(serializePlanQuestion) : UNCHANGED
        }
      : UNCHANGED;

  const newLinkedResources = snapshot.linkedResources.filter(
    (r) => new Date(r.createdAt).getTime() > since
  );
  const linkedResources =
    newLinkedResources.length > 0 ? newLinkedResources.map(serializeLinkedResource) : UNCHANGED;

  const newLinkedTasks = snapshot.linkedTasks.filter(
    (t) => new Date(t.createdAt).getTime() > since
  );
  const linkedTasks =
    newLinkedTasks.length > 0 ? newLinkedTasks.map(serializeLinkedTask) : UNCHANGED;

  return { delta: true, since: sinceDate, task, plan, linkedResources, linkedTasks };
}

export function serializeAgentSession(session: AgentSession) {
  return {
    interactionCount: session.interactionCount,
    lastContextVersion: session.lastContextVersion,
    lastMode: session.lastMode,
    lastUsedAt: session.lastUsedAt,
    runId: session.runId,
    state: session.state,
    taskId: session.taskId
  };
}
