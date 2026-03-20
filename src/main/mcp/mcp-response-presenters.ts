/*
Назначение: Формирует компактные внешние ответы MCP из внутренних доменных моделей приложения.
Не входит: Регистрация MCP-инструментов, бизнес-логика сервисов и desktop-контракты renderer.
*/
import { parseManagedPlanContent, type ManagedPlanComment } from "../../shared/plans/managed-plan-content";
import type { AppService } from "../services/app-service";

type ProjectRecord = Awaited<ReturnType<AppService["listProjects"]>>[number];
type ResourceRecord = Awaited<ReturnType<AppService["listResources"]>>[number];
type TaskDetail = Awaited<ReturnType<AppService["getTaskDetail"]>>;
type TaskRecord = Awaited<ReturnType<AppService["listTasks"]>>[number];

function renderPlanContent(contentMd: string): string {
  return parseManagedPlanContent(contentMd).renderedContentMd;
}

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
    title: task.title
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

function serializePlanSummary(plan: TaskDetail["plan"], taskId: string) {
  if (!plan) {
    return {
      exists: false,
      taskId
    };
  }

  return {
    exists: true,
    source: plan.source,
    taskId
  };
}

export function serializePlan(plan: TaskDetail["plan"], taskId: string) {
  if (!plan) {
    return {
      contentMd: "",
      exists: false,
      taskId
    };
  }

  return {
    contentMd: renderPlanContent(plan.contentMd),
    exists: true,
    source: plan.source,
    taskId
  };
}

export function serializeTaskDetail(detail: TaskDetail) {
  const linkedResources = detail.linkedResources.map(serializeLinkedResource);

  return {
    linkedResources,
    linkedTasks: detail.linkedTasks.map(serializeLinkedTask),
    plan: serializePlanSummary(detail.plan, detail.task.id),
    project: serializeProjectSummary(detail.project),
    resourceReadme: {
      hasLinkedResources: linkedResources.length > 0,
      readTool: "get_resource",
      recommendedAction:
        linkedResources.length > 0
          ? "После get_task прочитай связанные ресурсы через get_resource, если они нужны для планирования или реализации."
          : "У задачи нет связанных ресурсов."
    },
    task: serializeTask(detail.task)
  };
}

export function serializeTaskCollection(tasks: TaskRecord[], project?: ProjectRecord) {
  return {
    project: project ? serializeProjectSummary(project) : null,
    tasks: tasks.map(serializeTask)
  };
}

function serializePlanComment(comment: ManagedPlanComment) {
  return {
    author: comment.author,
    content: comment.content,
    id: comment.id
  };
}

export function serializePlanExtension(taskId: string, extension: ManagedPlanComment) {
  return {
    extension: serializePlanComment(extension),
    taskId
  };
}

export function serializePlanImprovement(taskId: string, improvement: ManagedPlanComment) {
  return {
    improvement: serializePlanComment(improvement),
    taskId
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
