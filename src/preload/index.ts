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
  CreatePromptHintInput,
  CreateResourceInput,
  CreateTaskInput,
  DeletePromptHintInput,
  DeletePromptOverrideInput,
  DesktopDataChangeEvent,
  DesktopApi,
  ListPromptHintsInput,
  LinkResourceInput,
  LinkTaskInput,
  RestorePlanRevisionInput,
  SavePlanInput,
  SearchPromptHintsInput,
  SetWindowTitleContextInput,
  UnlinkResourceInput,
  UnlinkTaskInput,
  UpdatePromptHintInput,
  UpdateResourceInput,
  UpdateTaskInput,
  UpdateTaskStatusInput,
  UpdateProjectProfileInput,
  UpsertPromptOverrideInput,
  WindowTheme
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
  onDataChanged: "app:data-changed",
  restorePlanRevision: "app:restore-plan-revision",
  savePlan: "app:save-plan",
  searchPromptHints: "app:search-prompt-hints",
  setWindowTheme: "app:set-window-theme",
  setWindowTitleContext: "app:set-window-title-context",
  unlinkResource: "app:unlink-resource",
  unlinkTask: "app:unlink-task",
  updateResource: "app:update-resource",
  updateTask: "app:update-task",
  updateTaskStatus: "app:update-task-status",
  updateProjectProfile: "app:update-project-profile",
  updatePromptHint: "app:update-prompt-hint",
  upsertPromptOverride: "app:upsert-prompt-override"
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
    createPromptHint(input: CreatePromptHintInput) {
      return runtime.ipcRenderer.invoke(channels.createPromptHint, input);
    },
    createTask(input: CreateTaskInput) {
      return runtime.ipcRenderer.invoke(channels.createTask, input);
    },
    createResource(input: CreateResourceInput) {
      return runtime.ipcRenderer.invoke(channels.createResource, input);
    },
    deleteTask(taskId: string) {
      return runtime.ipcRenderer.invoke(channels.deleteTask, taskId);
    },
    deleteResource(id: string) {
      return runtime.ipcRenderer.invoke(channels.deleteResource, id);
    },
    deletePromptHint(input: DeletePromptHintInput) {
      return runtime.ipcRenderer.invoke(channels.deletePromptHint, input);
    },
    exportData() {
      return runtime.ipcRenderer.invoke(channels.exportData);
    },
    getHealth() {
      return runtime.ipcRenderer.invoke(channels.getHealth);
    },
    getProject(projectId: string) {
      return runtime.ipcRenderer.invoke(channels.getProject, projectId);
    },
    getResource(id: string) {
      return runtime.ipcRenderer.invoke(channels.getResource, id);
    },
    getTaskDetail(taskId: string) {
      return runtime.ipcRenderer.invoke(channels.getTaskDetail, taskId);
    },
    importData() {
      return runtime.ipcRenderer.invoke(channels.importData);
    },
    listProjects() {
      return runtime.ipcRenderer.invoke(channels.listProjects);
    },
    listPromptHints(input: ListPromptHintsInput) {
      return runtime.ipcRenderer.invoke(channels.listPromptHints, input);
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
    searchPromptHints(input: SearchPromptHintsInput) {
      return runtime.ipcRenderer.invoke(channels.searchPromptHints, input);
    },
    setWindowTheme(theme: WindowTheme) {
      return runtime.ipcRenderer.invoke(channels.setWindowTheme, theme);
    },
    setWindowTitleContext(input: SetWindowTitleContextInput) {
      return runtime.ipcRenderer.invoke(channels.setWindowTitleContext, input);
    },
    updateTaskStatus(input: UpdateTaskStatusInput) {
      return runtime.ipcRenderer.invoke(channels.updateTaskStatus, input);
    },
    updateProjectProfile(input: UpdateProjectProfileInput) {
      return runtime.ipcRenderer.invoke(channels.updateProjectProfile, input);
    },
    updatePromptHint(input: UpdatePromptHintInput) {
      return runtime.ipcRenderer.invoke(channels.updatePromptHint, input);
    },
    updateTask(input: UpdateTaskInput) {
      return runtime.ipcRenderer.invoke(channels.updateTask, input);
    },
    linkResource(input: LinkResourceInput) {
      return runtime.ipcRenderer.invoke(channels.linkResource, input);
    },
    linkTask(input: LinkTaskInput) {
      return runtime.ipcRenderer.invoke(channels.linkTask, input);
    },
    listResources() {
      return runtime.ipcRenderer.invoke(channels.listResources);
    },
    unlinkResource(input: UnlinkResourceInput) {
      return runtime.ipcRenderer.invoke(channels.unlinkResource, input);
    },
    unlinkTask(input: UnlinkTaskInput) {
      return runtime.ipcRenderer.invoke(channels.unlinkTask, input);
    },
    updateResource(input: UpdateResourceInput) {
      return runtime.ipcRenderer.invoke(channels.updateResource, input);
    },
    listPromptOverrides() {
      return runtime.ipcRenderer.invoke(channels.listPromptOverrides);
    },
    upsertPromptOverride(input: UpsertPromptOverrideInput) {
      return runtime.ipcRenderer.invoke(channels.upsertPromptOverride, input);
    },
    deletePromptOverride(input: DeletePromptOverrideInput) {
      return runtime.ipcRenderer.invoke(channels.deletePromptOverride, input);
    }
  };

  runtime.contextBridge.exposeInMainWorld("desktop", desktopApi);
}
