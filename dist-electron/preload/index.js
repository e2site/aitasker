// src/preload/index.ts
var channels = {
  answerPlanQuestion: "app:answer-plan-question",
  appendPlanExtension: "app:append-plan-extension",
  appendPlanImprovement: "app:append-plan-improvement",
  consolidatePlanDiscussion: "app:consolidate-plan-discussion",
  createProject: "app:create-project",
  createResource: "app:create-resource",
  createTask: "app:create-task",
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
  listPromptOverrides: "app:list-prompt-overrides",
  listProjects: "app:list-projects",
  listResources: "app:list-resources",
  listTasks: "app:list-tasks",
  onDataChanged: "app:data-changed",
  restorePlanRevision: "app:restore-plan-revision",
  savePlan: "app:save-plan",
  setWindowTheme: "app:set-window-theme",
  setWindowTitleContext: "app:set-window-title-context",
  unlinkResource: "app:unlink-resource",
  unlinkTask: "app:unlink-task",
  updateResource: "app:update-resource",
  updateTask: "app:update-task",
  updateTaskStatus: "app:update-task-status",
  updateProjectProfile: "app:update-project-profile",
  upsertPromptOverride: "app:upsert-prompt-override"
};
function registerDesktopApi(runtime) {
  const desktopApi = {
    answerPlanQuestion(input) {
      return runtime.ipcRenderer.invoke(channels.answerPlanQuestion, input);
    },
    appendPlanExtension(input) {
      return runtime.ipcRenderer.invoke(channels.appendPlanExtension, input);
    },
    appendPlanImprovement(input) {
      return runtime.ipcRenderer.invoke(channels.appendPlanImprovement, input);
    },
    consolidatePlanDiscussion(input) {
      return runtime.ipcRenderer.invoke(channels.consolidatePlanDiscussion, input);
    },
    createProject(input) {
      return runtime.ipcRenderer.invoke(channels.createProject, input);
    },
    createTask(input) {
      return runtime.ipcRenderer.invoke(channels.createTask, input);
    },
    createResource(input) {
      return runtime.ipcRenderer.invoke(channels.createResource, input);
    },
    deleteTask(taskId) {
      return runtime.ipcRenderer.invoke(channels.deleteTask, taskId);
    },
    deleteResource(id) {
      return runtime.ipcRenderer.invoke(channels.deleteResource, id);
    },
    exportData() {
      return runtime.ipcRenderer.invoke(channels.exportData);
    },
    getHealth() {
      return runtime.ipcRenderer.invoke(channels.getHealth);
    },
    getProject(projectId) {
      return runtime.ipcRenderer.invoke(channels.getProject, projectId);
    },
    getResource(id) {
      return runtime.ipcRenderer.invoke(channels.getResource, id);
    },
    getTaskDetail(taskId) {
      return runtime.ipcRenderer.invoke(channels.getTaskDetail, taskId);
    },
    importData() {
      return runtime.ipcRenderer.invoke(channels.importData);
    },
    listProjects() {
      return runtime.ipcRenderer.invoke(channels.listProjects);
    },
    listTasks() {
      return runtime.ipcRenderer.invoke(channels.listTasks);
    },
    onDataChanged(listener) {
      const subscription = (_event, payload) => {
        listener(payload);
      };
      runtime.ipcRenderer.on(channels.onDataChanged, subscription);
      return () => {
        runtime.ipcRenderer.removeListener(channels.onDataChanged, subscription);
      };
    },
    onFocusTask(listener) {
      const subscription = (_event, taskId) => {
        listener(taskId);
      };
      runtime.ipcRenderer.on("app:focus-task", subscription);
      return () => {
        runtime.ipcRenderer.removeListener("app:focus-task", subscription);
      };
    },
    restorePlanRevision(input) {
      return runtime.ipcRenderer.invoke(channels.restorePlanRevision, input);
    },
    savePlan(input) {
      return runtime.ipcRenderer.invoke(channels.savePlan, input);
    },
    setWindowTheme(theme) {
      return runtime.ipcRenderer.invoke(channels.setWindowTheme, theme);
    },
    setWindowTitleContext(input) {
      return runtime.ipcRenderer.invoke(channels.setWindowTitleContext, input);
    },
    updateTaskStatus(input) {
      return runtime.ipcRenderer.invoke(channels.updateTaskStatus, input);
    },
    updateProjectProfile(input) {
      return runtime.ipcRenderer.invoke(channels.updateProjectProfile, input);
    },
    updateTask(input) {
      return runtime.ipcRenderer.invoke(channels.updateTask, input);
    },
    linkResource(input) {
      return runtime.ipcRenderer.invoke(channels.linkResource, input);
    },
    linkTask(input) {
      return runtime.ipcRenderer.invoke(channels.linkTask, input);
    },
    listResources() {
      return runtime.ipcRenderer.invoke(channels.listResources);
    },
    unlinkResource(input) {
      return runtime.ipcRenderer.invoke(channels.unlinkResource, input);
    },
    unlinkTask(input) {
      return runtime.ipcRenderer.invoke(channels.unlinkTask, input);
    },
    updateResource(input) {
      return runtime.ipcRenderer.invoke(channels.updateResource, input);
    },
    listPromptOverrides() {
      return runtime.ipcRenderer.invoke(channels.listPromptOverrides);
    },
    upsertPromptOverride(input) {
      return runtime.ipcRenderer.invoke(channels.upsertPromptOverride, input);
    },
    deletePromptOverride(input) {
      return runtime.ipcRenderer.invoke(channels.deletePromptOverride, input);
    }
  };
  runtime.contextBridge.exposeInMainWorld("desktop", desktopApi);
}
export {
  registerDesktopApi
};
//# sourceMappingURL=index.js.map