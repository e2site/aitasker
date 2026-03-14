// src/preload/index.ts
var channels = {
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
    deleteTask(taskId) {
      return runtime.ipcRenderer.invoke(channels.deleteTask, taskId);
    },
    getHealth() {
      return runtime.ipcRenderer.invoke(channels.getHealth);
    },
    getProject(projectId) {
      return runtime.ipcRenderer.invoke(channels.getProject, projectId);
    },
    getTaskDetail(taskId) {
      return runtime.ipcRenderer.invoke(channels.getTaskDetail, taskId);
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
    updateTaskStatus(input) {
      return runtime.ipcRenderer.invoke(channels.updateTaskStatus, input);
    },
    updateProjectProfile(input) {
      return runtime.ipcRenderer.invoke(channels.updateProjectProfile, input);
    }
  };
  runtime.contextBridge.exposeInMainWorld("desktop", desktopApi);
}
export {
  registerDesktopApi
};
//# sourceMappingURL=index.js.map