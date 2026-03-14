/*
Назначение: Рендерит основной workspace — топ-бар с выбором проекта, таблицу задач и split-панель деталей задачи.
Не входит: Многостраничная навигация, совместное редактирование и сложные approval-flow.
*/
import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { useAtom } from "jotai";
import { AppShell } from "@/renderer/components/app-shell";
import { TaskDetailPanel } from "@/renderer/components/task-detail-panel";
import { TaskTable } from "@/renderer/components/task-table";
import { TaskTableTopBar } from "@/renderer/components/task-table-top-bar";
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
import { selectedTaskIdAtom } from "@/renderer/features/tasks/selected-task-id-state";
import {
  useCreateTaskMutation,
  useDeleteTaskMutation,
  useTaskDetailQuery,
  useTasksQuery,
  useUpdateTaskStatusMutation
} from "@/renderer/features/tasks/use-task-queries";
import type { TaskStatus } from "@/shared/contracts/desktop-api";
import { cn } from "@/renderer/components/ui/class-names";

const STATUS_DOT_COLORS: Record<TaskStatus, string> = {
  new: "#94a3b8",
  planning: "#38bdf8",
  requires_clarification: "#f87171",
  implementation: "#fbbf24",
  completed: "#34d399",
};

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

  const [selectedProjectId, setSelectedProjectId] = useAtom(selectedProjectIdAtom);
  const [selectedTaskId, setSelectedTaskId] = useAtom(selectedTaskIdAtom);
  const [editorMode, setEditorMode] = useAtom(planEditorModeAtom);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>([]);
  const [tableCollapsed, setTableCollapsed] = useState(false);

  // Open task when tray notification is clicked
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

  const visibleTasks = selectedProjectId
    ? allTasks.filter((task) => task.projectId === selectedProjectId)
    : allTasks;

  const filteredTasks = visibleTasks
    .filter((task) => selectedStatuses.length === 0 || selectedStatuses.includes(task.status))
    .filter(
      (task) =>
        !searchQuery ||
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

  // Reset selected project if it no longer exists
  useEffect(() => {
    if (selectedProjectId === null) return;
    const exists = projects.some((p) => p.id === selectedProjectId);
    if (!exists) setSelectedProjectId(null);
  }, [projects, selectedProjectId, setSelectedProjectId]);

  // Auto-select first visible task when project changes or tasks load
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
    createTaskMutation.error ||
    deleteTaskMutation.error ||
    updateTaskStatusMutation.error ||
    savePlanMutation.error ||
    answerPlanQuestionMutation.error ||
    restorePlanRevisionMutation.error ||
    appendPlanExtensionMutation.error ||
    appendPlanImprovementMutation.error ||
    updateProjectProfileMutation.error ||
    createProjectMutation.error;

  const errorMessage =
    createTaskMutation.error?.message ||
    deleteTaskMutation.error?.message ||
    updateTaskStatusMutation.error?.message ||
    savePlanMutation.error?.message ||
    answerPlanQuestionMutation.error?.message ||
    restorePlanRevisionMutation.error?.message ||
    appendPlanExtensionMutation.error?.message ||
    appendPlanImprovementMutation.error?.message ||
    updateProjectProfileMutation.error?.message ||
    createProjectMutation.error?.message;

  return (
    <AppShell>
      <div className="flex min-h-0 flex-col gap-4" style={{ gridColumn: "1 / -1" }}>
        {/* Top bar */}
        <TaskTableTopBar
          allTasks={allTasks}
          filteredCount={filteredTasks.length}
          isCreating={createTaskMutation.isPending}
          isCreatingProject={createProjectMutation.isPending}
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
          onCreateProject={(name) => {
            createProjectMutation.mutate({ name }, {
              onSuccess(project) {
                setSelectedProjectId(project.id);
              }
            });
          }}
          onSelectProject={(projectId) => {
            setSelectedProjectId(projectId);
            setEditorMode("view");
          }}
          onStatusFilterChange={setSelectedStatuses}
          onSearchChange={setSearchQuery}
          onUpdateProjectProfile={(input) => updateProjectProfileMutation.mutate(input)}
          projects={projects}
          searchQuery={searchQuery}
          selectedProjectId={selectedProjectId}
          selectedStatuses={selectedStatuses}
          totalCount={visibleTasks.length}
        />

        {/* Error banner */}
        {anyError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        {/* Main content: table + detail split */}
        <div className="flex min-h-0 flex-1 gap-4">
          {/* Table — full or collapsed strip */}
          {selectedTaskId && tableCollapsed ? (
            /* Collapsed: narrow strip with status dots + expand button */
            <div className="flex w-10 flex-col items-center gap-1 rounded-2xl border border-slate-200 bg-white py-3">
              <button
                type="button"
                title="Развернуть список"
                onClick={() => setTableCollapsed(false)}
                className="mb-1 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
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
                    task.id === selectedTaskId ? "ring-2 ring-slate-400 ring-offset-1" : ""
                  )}
                  style={{ backgroundColor: STATUS_DOT_COLORS[task.status] }}
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
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <ChevronsLeft className="size-4" />
                  </button>
                </div>
              )}
              <TaskTable
                tasks={filteredTasks}
                selectedTaskId={selectedTaskId}
                showProject={selectedProjectId === null}
                onSelect={(taskId) => {
                  setSelectedTaskId(taskId);
                  setEditorMode("view");
                }}
              />
            </div>
          )}

          {/* Detail panel (split-view, ~50% или full width при свёрнутом списке) */}
          {selectedTaskId && (
            <div className={cn("relative min-w-[420px]", tableCollapsed ? "flex-1" : "w-full max-w-[50%]")}>
              {/* Close button — floating over the panel card */}
              <button
                type="button"
                title="Закрыть панель"
                onClick={() => {
                  setSelectedTaskId(null);
                  setEditorMode("view");
                }}
                className="absolute right-6 top-6 z-10 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
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
                  isRestoringRevision={restorePlanRevisionMutation.isPending}
                  isSavingPlan={savePlanMutation.isPending}
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
                  onSetEditorMode={setEditorMode}
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
