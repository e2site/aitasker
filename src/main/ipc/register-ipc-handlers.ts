/*
Назначение: Регистрирует типизированные IPC-обработчики для доступа renderer к сервису проектов, задач и планов.
Не входит: Реализация preload, репозиториев и composition логики в renderer.
*/
import type { IpcMain } from "electron";
import type { AppService } from "../services/app-service";

const channels = {
  appendPlanNote: "app:append-plan-note",
  createProject: "app:create-project",
  createTask: "app:create-task",
  deleteTask: "app:delete-task",
  getHealth: "app:get-health",
  getProject: "app:get-project",
  getTaskDetail: "app:get-task-detail",
  listProjects: "app:list-projects",
  listTasks: "app:list-tasks",
  savePlan: "app:save-plan",
  updateTaskStatus: "app:update-task-status",
  updateProjectProfile: "app:update-project-profile"
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
  ipcMain.handle(channels.getHealth, () => withIpcErrors(() => appService.getHealthSnapshot()));
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
  ipcMain.handle(channels.createTask, (_event, input) =>
    withIpcErrors(() => appService.createTask(input))
  );
  ipcMain.handle(channels.deleteTask, (_event, taskId: string) =>
    withIpcErrors(() => appService.deleteTask(taskId))
  );
  ipcMain.handle(channels.savePlan, (_event, input) =>
    withIpcErrors(() => appService.savePlan(input))
  );
  ipcMain.handle(channels.appendPlanNote, (_event, input) =>
    withIpcErrors(() => appService.appendPlanNote(input))
  );
  ipcMain.handle(channels.updateTaskStatus, (_event, input) =>
    withIpcErrors(() => appService.updateTaskStatus(input))
  );
  ipcMain.handle(channels.updateProjectProfile, (_event, input) =>
    withIpcErrors(() => appService.updateProjectProfile(input))
  );
}
