/*
Назначение: Пробрасывает типизированный desktop API из preload в renderer через безопасный bridge.
Не входит: Регистрация IPC-обработчиков, логика репозиториев и рендеринг интерфейса.
*/
import type {
  AppendPlanNoteInput,
  CreateProjectInput,
  CreateTaskInput,
  DesktopApi,
  SavePlanInput,
  UpdateTaskStatusInput,
  UpdateProjectProfileInput
} from "../shared/contracts/desktop-api";
import type { ContextBridge, IpcRenderer } from "electron";

export interface PreloadRuntime {
  contextBridge: ContextBridge;
  ipcRenderer: IpcRenderer;
}

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

export function registerDesktopApi(runtime: PreloadRuntime): void {
  const desktopApi: DesktopApi = {
    appendPlanNote(input: AppendPlanNoteInput) {
      return runtime.ipcRenderer.invoke(channels.appendPlanNote, input);
    },
    createProject(input: CreateProjectInput) {
      return runtime.ipcRenderer.invoke(channels.createProject, input);
    },
    createTask(input: CreateTaskInput) {
      return runtime.ipcRenderer.invoke(channels.createTask, input);
    },
    deleteTask(taskId: string) {
      return runtime.ipcRenderer.invoke(channels.deleteTask, taskId);
    },
    getHealth() {
      return runtime.ipcRenderer.invoke(channels.getHealth);
    },
    getProject(projectId: string) {
      return runtime.ipcRenderer.invoke(channels.getProject, projectId);
    },
    getTaskDetail(taskId: string) {
      return runtime.ipcRenderer.invoke(channels.getTaskDetail, taskId);
    },
    listProjects() {
      return runtime.ipcRenderer.invoke(channels.listProjects);
    },
    listTasks() {
      return runtime.ipcRenderer.invoke(channels.listTasks);
    },
    savePlan(input: SavePlanInput) {
      return runtime.ipcRenderer.invoke(channels.savePlan, input);
    },
    updateTaskStatus(input: UpdateTaskStatusInput) {
      return runtime.ipcRenderer.invoke(channels.updateTaskStatus, input);
    },
    updateProjectProfile(input: UpdateProjectProfileInput) {
      return runtime.ipcRenderer.invoke(channels.updateProjectProfile, input);
    }
  };

  runtime.contextBridge.exposeInMainWorld("desktop", desktopApi);
}
