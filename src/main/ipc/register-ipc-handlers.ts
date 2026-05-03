/*
Назначение: Регистрирует типизированные IPC-обработчики для доступа renderer к сервису проектов, задач, планов и их служебных блоков.
Не входит: Реализация preload, репозиториев и composition логики в renderer.
*/
import type { IpcMain } from "electron";
import type { AppService } from "../services/app-service";

const channels = {
  answerPlanQuestion: "app:answer-plan-question",
  appendPlanExtension: "app:append-plan-extension",
  appendPlanImprovement: "app:append-plan-improvement",
  consolidatePlanDiscussion: "app:consolidate-plan-discussion",
  createProject: "app:create-project",
  createPromptHint: "app:create-prompt-hint",
  createResource: "app:create-resource",
  createTask: "app:create-task",
  deletePromptHint: "app:delete-prompt-hint",
  deletePromptOverride: "app:delete-prompt-override",
  deleteResource: "app:delete-resource",
  deleteTask: "app:delete-task",
  exportData: "app:export-data",
  getHealth: "app:get-health",
  getProject: "app:get-project",
  getResource: "app:get-resource",
  getTaskDetail: "app:get-task-detail",
  importData: "app:import-data",
  linkResource: "app:link-resource",
  linkTask: "app:link-task",
  listPromptHints: "app:list-prompt-hints",
  listPromptOverrides: "app:list-prompt-overrides",
  listProjects: "app:list-projects",
  listResources: "app:list-resources",
  listTasks: "app:list-tasks",
  reindexPromptHints: "app:reindex-prompt-hints",
  restorePlanRevision: "app:restore-plan-revision",
  savePlan: "app:save-plan",
  searchPromptHints: "app:search-prompt-hints",
  unlinkResource: "app:unlink-resource",
  unlinkTask: "app:unlink-task",
  updateResource: "app:update-resource",
  updateTask: "app:update-task",
  updateTaskStatus: "app:update-task-status",
  updateProjectProfile: "app:update-project-profile",
  updatePromptHint: "app:update-prompt-hint",
  upsertPromptOverride: "app:upsert-prompt-override"
} as const;

async function withIpcErrors<T>(action: () => Promise<T> | T): Promise<T> {
  try {
    return await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown IPC error";
    throw new Error(message);
  }
}

export function registerIpcHandlers(ipcMain: IpcMain, appService: AppService): void {
  ipcMain.handle(channels.exportData, () => withIpcErrors(() => appService.exportData()));
  ipcMain.handle(channels.getHealth, () => withIpcErrors(() => appService.getHealthSnapshot()));
  ipcMain.handle(channels.importData, () => withIpcErrors(() => appService.importData()));
  ipcMain.handle(channels.listProjects, () => withIpcErrors(() => appService.listProjects()));
  ipcMain.handle(channels.listTasks, () => withIpcErrors(() => appService.listTasks()));
  ipcMain.handle(channels.getProject, (_event, projectId: string) =>
    withIpcErrors(() => appService.getProject(projectId))
  );
  ipcMain.handle(channels.getTaskDetail, (_event, taskId: string) =>
    withIpcErrors(() => appService.getTaskDetail(taskId))
  );
  ipcMain.handle(channels.createProject, (_event, input) =>
    withIpcErrors(() => appService.createProject(input))
  );
  ipcMain.handle(channels.createPromptHint, (_event, input) =>
    withIpcErrors(() => appService.createPromptHint(input))
  );
  ipcMain.handle(channels.createTask, (_event, input) =>
    withIpcErrors(() => appService.createTask(input))
  );
  ipcMain.handle(channels.deleteTask, (_event, taskId: string) =>
    withIpcErrors(() => appService.deleteTask(taskId))
  );
  ipcMain.handle(channels.deletePromptHint, (_event, input) =>
    withIpcErrors(() => appService.deletePromptHint(input))
  );
  ipcMain.handle(channels.restorePlanRevision, (_event, input) =>
    withIpcErrors(() => appService.restorePlanRevision(input))
  );
  ipcMain.handle(channels.savePlan, (_event, input) =>
    withIpcErrors(() => appService.savePlan(input))
  );
  ipcMain.handle(channels.answerPlanQuestion, (_event, input) =>
    withIpcErrors(() => appService.answerPlanQuestion(input))
  );
  ipcMain.handle(channels.appendPlanExtension, (_event, input) =>
    withIpcErrors(() => appService.appendPlanExtension(input))
  );
  ipcMain.handle(channels.appendPlanImprovement, (_event, input) =>
    withIpcErrors(() => appService.appendPlanImprovement(input))
  );
  ipcMain.handle(channels.consolidatePlanDiscussion, (_event, input) =>
    withIpcErrors(() => appService.consolidatePlanDiscussion(input))
  );
  ipcMain.handle(channels.updateTask, (_event, input) =>
    withIpcErrors(() => appService.updateTask(input))
  );
  ipcMain.handle(channels.updateTaskStatus, (_event, input) =>
    withIpcErrors(() => appService.updateTaskStatus(input))
  );
  ipcMain.handle(channels.updateProjectProfile, (_event, input) =>
    withIpcErrors(() => appService.updateProjectProfile(input))
  );
  ipcMain.handle(channels.linkTask, (_event, input) =>
    withIpcErrors(() => appService.linkTask(input))
  );
  ipcMain.handle(channels.unlinkTask, (_event, input) =>
    withIpcErrors(() => appService.unlinkTask(input))
  );
  ipcMain.handle(channels.listPromptOverrides, () =>
    withIpcErrors(() => appService.listPromptOverrides())
  );
  ipcMain.handle(channels.upsertPromptOverride, (_event, input) =>
    withIpcErrors(() => appService.upsertPromptOverride(input))
  );
  ipcMain.handle(channels.deletePromptOverride, (_event, input) =>
    withIpcErrors(() => appService.deletePromptOverride(input))
  );
  ipcMain.handle(channels.createResource, (_event, input) =>
    withIpcErrors(() => appService.createResource(input))
  );
  ipcMain.handle(channels.getResource, (_event, id: string) =>
    withIpcErrors(() => appService.getResource(id))
  );
  ipcMain.handle(channels.listResources, () =>
    withIpcErrors(() => appService.listResources())
  );
  ipcMain.handle(channels.listPromptHints, (_event, input) =>
    withIpcErrors(() => appService.listPromptHints(input))
  );
  ipcMain.handle(channels.reindexPromptHints, () =>
    withIpcErrors(() => appService.reindexPromptHints())
  );
  ipcMain.handle(channels.searchPromptHints, (_event, input) =>
    withIpcErrors(() => appService.searchPromptHints(input))
  );
  ipcMain.handle(channels.updateResource, (_event, input) =>
    withIpcErrors(() => appService.updateResource(input))
  );
  ipcMain.handle(channels.updatePromptHint, (_event, input) =>
    withIpcErrors(() => appService.updatePromptHint(input))
  );
  ipcMain.handle(channels.deleteResource, (_event, id: string) =>
    withIpcErrors(() => appService.deleteResource(id))
  );
  ipcMain.handle(channels.linkResource, (_event, input) =>
    withIpcErrors(() => appService.linkResource(input))
  );
  ipcMain.handle(channels.unlinkResource, (_event, input) =>
    withIpcErrors(() => appService.unlinkResource(input))
  );
}
