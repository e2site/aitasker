// src/preload/index.ts
var channels = {
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
};
function registerDesktopApi(runtime) {
  const desktopApi = {
    appendPlanNote(input) {
      return runtime.ipcRenderer.invoke(channels.appendPlanNote, input);
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