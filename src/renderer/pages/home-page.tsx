/*
Назначение: Рендерит основной workspace — таблицу задач и split-панель деталей задачи.
Не входит: Многостраничная навигация, совместное редактирование и сложные approval-flow.
*/
import { useEffect, useRef, useState } from "react";
import { ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { useAtom } from "jotai";
import { AppShell } from "@/renderer/components/app-shell";
import { TaskDetailPanel } from "@/renderer/components/task-detail-panel";
import { TaskTable } from "@/renderer/components/task-table";
import { TaskTableTopBar, type TaskTableTopBarHandle } from "@/renderer/components/task-table-top-bar";
import { planEditorModeAtom } from "@/renderer/features/plans/plan-editor-mode-state";
import {
  useAnswerPlanQuestionMutation,
  useAppendPlanExtensionMutation,
  useAppendPlanImprovementMutation,
  useRestorePlanRevisionMutation,
  useSavePlanMutation
} from "@/renderer/features/plans/use-plan-mutations";
import { selectedProjectIdAtom } from "@/renderer/features/projects/selected-project-id-state";
import { useCreateProjectMutation, useProjectsQuery, useUpdateProjectProfileMutation } from "@/renderer/features/projects/use-project-queries";
import { useExportDataMutation, useImportDataMutation } from "@/renderer/features/data/use-data-mutations";
import { selectedTaskIdAtom } from "@/renderer/features/tasks/selected-task-id-state";
import {
  useCreateTaskMutation,
  useDeleteTaskMutation,
  useLinkTaskMutation,
  useTaskDetailQuery,
  useTasksQuery,
  useUnlinkTaskMutation,
  useUpdateTaskMutation,
  useUpdateTaskStatusMutation
} from "@/renderer/features/tasks/use-task-queries";
import {
  useLinkResourceMutation,
  useUnlinkResourceMutation
} from "@/renderer/features/resources/use-resource-mutations";
import type { TaskStatus } from "@/shared/contracts/desktop-api";
import { getTaskStatusMeta } from "@/renderer/features/tasks/task-status-meta";
import { cn } from "@/renderer/components/ui/class-names";

export function HomePage() {
  const projectsQuery = useProjectsQuery();
  const createProjectMutation = useCreateProjectMutation();
  const updateProjectProfileMutation = useUpdateProjectProfileMutation();
  const tasksQuery = useTasksQuery();
  const createTaskMutation = useCreateTaskMutation();
  const deleteTaskMutation = useDeleteTaskMutation();
  const updateTaskStatusMutation = useUpdateTaskStatusMutation();
  const savePlanMutation = useSavePlanMutation();
  const answerPlanQuestionMutation = useAnswerPlanQuestionMutation();
  const restorePlanRevisionMutation = useRestorePlanRevisionMutation();
  const appendPlanExtensionMutation = useAppendPlanExtensionMutation();
  const appendPlanImprovementMutation = useAppendPlanImprovementMutation();
  const updateTaskMutation = useUpdateTaskMutation();
  const linkTaskMutation = useLinkTaskMutation();
  const unlinkTaskMutation = useUnlinkTaskMutation();
  const linkResourceMutation = useLinkResourceMutation();
  const unlinkResourceMutation = useUnlinkResourceMutation();
  const exportDataMutation = useExportDataMutation();
  const importDataMutation = useImportDataMutation();

  const [selectedProjectId, setSelectedProjectId] = useAtom(selectedProjectIdAtom);
  const [selectedTaskId, setSelectedTaskId] = useAtom(selectedTaskIdAtom);
  const [editorMode, setEditorMode] = useAtom(planEditorModeAtom);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>([]);
  const [tableCollapsed, setTableCollapsed] = useState(false);

  const topBarRef = useRef<TaskTableTopBarHandle>(null);

  useEffect(() => {
    return window.desktop.onFocusTask((taskId) => {
      setSelectedTaskId(taskId);
      setEditorMode("view");
      setTableCollapsed(false);
    });
  }, [setSelectedTaskId, setEditorMode]);

  const taskDetailQuery = useTaskDetailQuery(selectedTaskId);
  const allTasks = tasksQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const selectedTask = selectedTaskId ? allTasks.find((task) => task.id === selectedTaskId) ?? null : null;
  const selectedProjectName = selectedProjectId
    ? projects.find((project) => project.id === selectedProjectId)?.name ?? selectedTask?.projectName ?? null
    : selectedTask?.projectName ?? null;
  const selectedTaskTitle = selectedTask?.title ?? null;

  useEffect(() => {
    void window.desktop.setWindowTitleContext({
      projectName: selectedProjectName,
      taskTitle: selectedTaskTitle
    });
  }, [selectedProjectName, selectedTaskTitle]);

  const visibleTasks = selectedProjectId
    ? allTasks.filter((task) => task.projectId === selectedProjectId)
    : allTasks;

  const filteredTasks = visibleTasks
    .filter((task) => selectedStatuses.length === 0 || selectedStatuses.includes(task.status))
    .filter(
      (task) =>
        !searchQuery ||
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.planContentMd ?? "").toLowerCase().includes(searchQuery.toLowerCase())
    );

  useEffect(() => {
    if (selectedProjectId === null) return;
    const exists = projects.some((p) => p.id === selectedProjectId);
    if (!exists) setSelectedProjectId(null);
  }, [projects, selectedProjectId, setSelectedProjectId]);

  useEffect(() => {
    const inProject = visibleTasks.some((task) => task.id === selectedTaskId);
    if (!selectedTaskId && visibleTasks.length > 0) {
      setSelectedTaskId(visibleTasks[0].id);
      return;
    }
    if (!inProject) {
      setSelectedTaskId(visibleTasks[0]?.id ?? null);
      setEditorMode("view");
    }
  }, [selectedProjectId, selectedTaskId, setEditorMode, setSelectedTaskId, visibleTasks]);

  const anyError =
    createTaskMutation.error || deleteTaskMutation.error || linkTaskMutation.error ||
    unlinkTaskMutation.error || updateTaskMutation.error || updateTaskStatusMutation.error ||
    savePlanMutation.error || answerPlanQuestionMutation.error || restorePlanRevisionMutation.error ||
    appendPlanExtensionMutation.error || appendPlanImprovementMutation.error ||
    updateProjectProfileMutation.error || createProjectMutation.error ||
    exportDataMutation.error || importDataMutation.error;

  const errorMessage =
    createTaskMutation.error?.message || deleteTaskMutation.error?.message ||
    linkTaskMutation.error?.message || unlinkTaskMutation.error?.message ||
    updateTaskMutation.error?.message || updateTaskStatusMutation.error?.message ||
    savePlanMutation.error?.message || answerPlanQuestionMutation.error?.message ||
    restorePlanRevisionMutation.error?.message || appendPlanExtensionMutation.error?.message ||
    appendPlanImprovementMutation.error?.message || updateProjectProfileMutation.error?.message ||
    createProjectMutation.error?.message || exportDataMutation.error?.message ||
    importDataMutation.error?.message;

  return (
    <AppShell>
      {/* Headless: app-menu actions + create-task modal + prompt toast */}
      <TaskTableTopBar
        ref={topBarRef}
        isCreating={createTaskMutation.isPending}
        isExportingData={exportDataMutation.isPending}
        isImportingData={importDataMutation.isPending}
        isUpdatingProject={updateProjectProfileMutation.isPending}
        onCreate={(input) => {
          createTaskMutation.mutate(input, {
            onSuccess(detail) {
              setSelectedProjectId(detail.task.projectId);
              setSelectedTaskId(detail.task.id);
              setEditorMode("view");
            }
          });
        }}
        onExportData={() => exportDataMutation.mutate()}
        onImportData={() => importDataMutation.mutate()}
        onUpdateProjectProfile={(input) => updateProjectProfileMutation.mutate(input)}
        projects={projects}
        selectedProjectId={selectedProjectId}
      />

      <div className="flex min-h-0 flex-col gap-4" style={{ gridColumn: "1 / -1" }}>
        {anyError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        <div className="flex min-h-0 flex-1 gap-4">
          {selectedTaskId && tableCollapsed ? (
            <div className="flex w-10 flex-col items-center gap-1 rounded-lg border py-3">
              <button
                type="button"
                title="Развернуть список"
                onClick={() => setTableCollapsed(false)}
                className="mb-1 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <ChevronsRight className="size-4" />
              </button>
              {filteredTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  title={task.title}
                  onClick={() => {
                    setSelectedTaskId(task.id);
                    setEditorMode("view");
                    setTableCollapsed(false);
                  }}
                  className={cn(
                    "size-2.5 rounded-full transition hover:scale-125",
                    task.id === selectedTaskId ? "ring-2 ring-muted-foreground ring-offset-1" : ""
                  )}
                  style={{ backgroundColor: getTaskStatusMeta(task.status).dotColor }}
                />
              ))}
            </div>
          ) : (
            <div className={selectedTaskId ? "flex-1 min-w-0" : "w-full"}>
              {selectedTaskId && (
                <div className="mb-2 flex justify-end">
                  <button
                    type="button"
                    title="Свернуть список"
                    onClick={() => setTableCollapsed(true)}
                    className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <ChevronsLeft className="size-4" />
                  </button>
                </div>
              )}
              <TaskTable
                tasks={filteredTasks}
                filteredCount={filteredTasks.length}
                totalCount={visibleTasks.length}
                selectedTaskId={selectedTaskId}
                showProject={selectedProjectId === null}
                onSelect={(taskId) => {
                  setSelectedTaskId(taskId);
                  setEditorMode("view");
                }}
                searchQuery={searchQuery}
                selectedStatuses={selectedStatuses}
                onSearchChange={setSearchQuery}
                onStatusFilterChange={setSelectedStatuses}
              />
            </div>
          )}

          {selectedTaskId && (
            <div className={cn("relative min-w-[420px]", tableCollapsed ? "flex-1" : "w-full max-w-[50%]")}>
              <button
                type="button"
                title="Закрыть панель"
                onClick={() => {
                  setSelectedTaskId(null);
                  setEditorMode("view");
                }}
                className="absolute right-6 top-6 z-10 rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>

              <TaskDetailPanel
                detail={taskDetailQuery.data ?? null}
                editorMode={editorMode}
                isAppendingPlanExtension={appendPlanExtensionMutation.isPending}
                isAppendingPlanImprovement={appendPlanImprovementMutation.isPending}
                isAnsweringPlanQuestion={answerPlanQuestionMutation.isPending}
                isDeletingTask={deleteTaskMutation.isPending}
                isLinkingResource={linkResourceMutation.isPending}
                isRestoringRevision={restorePlanRevisionMutation.isPending}
                isSavingPlan={savePlanMutation.isPending}
                isLinkingTask={linkTaskMutation.isPending}
                isUnlinkingResource={unlinkResourceMutation.isPending}
                isUnlinkingTask={unlinkTaskMutation.isPending}
                isUpdatingTask={updateTaskMutation.isPending}
                isUpdatingStatus={updateTaskStatusMutation.isPending}
                onAppendPlanExtension={(taskId, content) => {
                  appendPlanExtensionMutation.mutate({ taskId, content, author: "human" });
                }}
                onAppendPlanImprovement={(taskId, content) => {
                  appendPlanImprovementMutation.mutate({ taskId, content, author: "human" });
                }}
                onAnswerPlanQuestion={(taskId, questionId, answer) => {
                  answerPlanQuestionMutation.mutate({ taskId, questionId, answer });
                }}
                onDeleteTask={(taskId) => {
                  const detail = taskDetailQuery.data;
                  if (!detail) return;
                  const confirmed = window.confirm(
                    `Удалить задачу "${detail.task.title}"? План и сессия агента тоже будут удалены.`
                  );
                  if (!confirmed) return;
                  deleteTaskMutation.mutate(taskId, {
                    onSuccess({ deletedTaskId }) {
                      const nextTask = visibleTasks.find((t) => t.id !== deletedTaskId) ?? null;
                      setSelectedTaskId(nextTask?.id ?? null);
                      setEditorMode("view");
                    }
                  });
                }}
                onRestorePlanRevision={(taskId, revisionId) => {
                  restorePlanRevisionMutation.mutate(
                    { taskId, revisionId },
                    { onSuccess() { setEditorMode("view"); } }
                  );
                }}
                onSavePlan={(taskId, contentMd) => {
                  savePlanMutation.mutate(
                    { taskId, contentMd, source: "human" },
                    { onSuccess() { setEditorMode("view"); } }
                  );
                }}
                onSaveTaskContract={(taskId, taskContext) => {
                  const detail = taskDetailQuery.data;

                  if (!detail || detail.task.id !== taskId || !detail.plan) {
                    return;
                  }

                  savePlanMutation.mutate({
                    taskId,
                    contentMd: detail.plan.contentMd,
                    source: "human",
                    goal: taskContext.goal,
                    criticalConditions: taskContext.criticalConditions,
                    forbiddenInterpretations: taskContext.forbiddenInterpretations,
                    acceptanceCriteria: taskContext.acceptanceCriteria
                  });
                }}
                onSetEditorMode={setEditorMode}
                onLinkResource={(resourceId, comment) => {
                  if (!selectedTaskId) return;
                  linkResourceMutation.mutate({ taskId: selectedTaskId, resourceId, comment });
                }}
                onLinkTask={(targetTaskId, comment) => {
                  if (!selectedTaskId) return;
                  linkTaskMutation.mutate({ sourceTaskId: selectedTaskId, targetTaskId, comment });
                }}
                onUnlinkResource={(linkId) => {
                  if (!selectedTaskId) return;
                  unlinkResourceMutation.mutate({ linkId, taskId: selectedTaskId });
                }}
                onUnlinkTask={(linkId) => {
                  if (!selectedTaskId) return;
                  unlinkTaskMutation.mutate({ linkId, taskId: selectedTaskId });
                }}
                onUpdateTask={(taskId, fields) => {
                  updateTaskMutation.mutate({ taskId, ...fields });
                }}
                onUpdateStatus={(taskId, status) => {
                  updateTaskStatusMutation.mutate({ taskId, status });
                }}
              />
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
