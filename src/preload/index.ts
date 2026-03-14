/*
Назначение: Пробрасывает типизированный desktop API из preload в renderer через безопасный bridge, включая операции с планом и его служебными блоками.
Не входит: Регистрация IPC-обработчиков, логика репозиториев и рендеринг интерфейса.
*/
import type {
  AnswerPlanQuestionInput,
  AppendPlanExtensionInput,
  AppendPlanImprovementInput,
  ConsolidatePlanDiscussionInput,
  CreateProjectInput,
  CreateTaskInput,
  DesktopDataChangeEvent,
  DesktopApi,
  RestorePlanRevisionInput,
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
  answerPlanQuestion: "app:answer-plan-question",
  appendPlanExtension: "app:append-plan-extension",
  appendPlanImprovement: "app:append-plan-improvement",
  consolidatePlanDiscussion: "app:consolidate-plan-discussion",
  createProject: "app:create-project",
  createTask: "app:create-task",
  deleteTask: "app:delete-task",
  getHealth: "app:get-health",
  getProject: "app:get-project",
  getTaskDetail: "app:get-task-detail",
  listProjects: "app:list-projects",
  listTasks: "app:list-tasks",
  onDataChanged: "app:data-changed",
  restorePlanRevision: "app:restore-plan-revision",
  savePlan: "app:save-plan",
  updateTaskStatus: "app:update-task-status",
  updateProjectProfile: "app:update-project-profile"
} as const;

export function registerDesktopApi(runtime: PreloadRuntime): void {
  const desktopApi: DesktopApi = {
    answerPlanQuestion(input: AnswerPlanQuestionInput) {
      return runtime.ipcRenderer.invoke(channels.answerPlanQuestion, input);
    },
    appendPlanExtension(input: AppendPlanExtensionInput) {
      return runtime.ipcRenderer.invoke(channels.appendPlanExtension, input);
    },
    appendPlanImprovement(input: AppendPlanImprovementInput) {
      return runtime.ipcRenderer.invoke(channels.appendPlanImprovement, input);
    },
    consolidatePlanDiscussion(input: ConsolidatePlanDiscussionInput) {
      return runtime.ipcRenderer.invoke(channels.consolidatePlanDiscussion, input);
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
    onDataChanged(listener: (event: DesktopDataChangeEvent) => void) {
      const subscription = (_event: unknown, payload: DesktopDataChangeEvent) => {
        listener(payload);
      };

      runtime.ipcRenderer.on(channels.onDataChanged, subscription);

      return () => {
        runtime.ipcRenderer.removeListener(channels.onDataChanged, subscription);
      };
    },
    onFocusTask(listener: (taskId: string) => void) {
      const subscription = (_event: unknown, taskId: string) => {
        listener(taskId);
      };

      runtime.ipcRenderer.on("app:focus-task", subscription);

      return () => {
        runtime.ipcRenderer.removeListener("app:focus-task", subscription);
      };
    },
    restorePlanRevision(input: RestorePlanRevisionInput) {
      return runtime.ipcRenderer.invoke(channels.restorePlanRevision, input);
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
