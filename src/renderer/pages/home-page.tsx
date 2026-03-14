/*
Назначение: Рендерит основной workspace для выбора проекта, работы с задачами и редактирования планов.
Не входит: Многостраничная навигация, совместное редактирование и сложные approval-flow.
*/
import { useEffect } from "react";
import { useAtom } from "jotai";
import { AppShell } from "@/renderer/components/app-shell";
import { TaskDetailPanel } from "@/renderer/components/task-detail-panel";
import { TaskListSidebar } from "@/renderer/components/task-list-sidebar";
import { planEditorModeAtom } from "@/renderer/features/plans/plan-editor-mode-state";
import { useAppendPlanNoteMutation, useSavePlanMutation } from "@/renderer/features/plans/use-plan-mutations";
import { selectedProjectIdAtom } from "@/renderer/features/projects/selected-project-id-state";
import { useProjectsQuery } from "@/renderer/features/projects/use-project-queries";
import { selectedTaskIdAtom } from "@/renderer/features/tasks/selected-task-id-state";
import {
  useCreateTaskMutation,
  useDeleteTaskMutation,
  useTaskDetailQuery,
  useTasksQuery,
  useUpdateTaskStatusMutation
} from "@/renderer/features/tasks/use-task-queries";

export function HomePage() {
  const projectsQuery = useProjectsQuery();
  const tasksQuery = useTasksQuery();
  const createTaskMutation = useCreateTaskMutation();
  const deleteTaskMutation = useDeleteTaskMutation();
  const updateTaskStatusMutation = useUpdateTaskStatusMutation();
  const savePlanMutation = useSavePlanMutation();
  const appendPlanNoteMutation = useAppendPlanNoteMutation();
  const [selectedProjectId, setSelectedProjectId] = useAtom(selectedProjectIdAtom);
  const [selectedTaskId, setSelectedTaskId] = useAtom(selectedTaskIdAtom);
  const [editorMode, setEditorMode] = useAtom(planEditorModeAtom);
  const taskDetailQuery = useTaskDetailQuery(selectedTaskId);
  const allTasks = tasksQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const visibleTasks = selectedProjectId
    ? allTasks.filter((task) => task.projectId === selectedProjectId)
    : allTasks;

  useEffect(() => {
    if (selectedProjectId === null) {
      return;
    }

    const selectedProjectExists = projects.some((project) => project.id === selectedProjectId);

    if (!selectedProjectExists) {
      setSelectedProjectId(null);
    }
  }, [projects, selectedProjectId, setSelectedProjectId]);

  useEffect(() => {
    const selectedTaskInProject = visibleTasks.some((task) => task.id === selectedTaskId);

    if (!selectedTaskId && visibleTasks.length > 0) {
      setSelectedTaskId(visibleTasks[0].id);
      return;
    }

    if (!selectedTaskInProject) {
      setSelectedTaskId(visibleTasks[0]?.id ?? null);
      setEditorMode("view");
    }
  }, [selectedProjectId, selectedTaskId, setEditorMode, setSelectedTaskId, visibleTasks]);

  return (
    <AppShell>
      <TaskListSidebar
        allTasks={allTasks}
        isCreating={createTaskMutation.isPending}
        projects={projects}
        selectedProjectId={selectedProjectId}
        selectedTaskId={selectedTaskId}
        tasks={visibleTasks}
        onSelectProject={(projectId) => {
          setSelectedProjectId(projectId);
          setEditorMode("view");
        }}
        onSelect={(taskId) => {
          setSelectedTaskId(taskId);
          setEditorMode("view");
        }}
        onCreate={(input) => {
          createTaskMutation.mutate(input, {
            onSuccess(detail) {
              setSelectedProjectId(detail.task.projectId);
              setSelectedTaskId(detail.task.id);
              setEditorMode("view");
            }
          });
        }}
      />

      <div className="space-y-4">
        {(createTaskMutation.error ||
          deleteTaskMutation.error ||
          updateTaskStatusMutation.error ||
          savePlanMutation.error ||
          appendPlanNoteMutation.error) ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {createTaskMutation.error?.message ||
              deleteTaskMutation.error?.message ||
              updateTaskStatusMutation.error?.message ||
              savePlanMutation.error?.message ||
              appendPlanNoteMutation.error?.message}
          </div>
        ) : null}

        <TaskDetailPanel
          detail={taskDetailQuery.data ?? null}
          editorMode={editorMode}
          isDeletingTask={deleteTaskMutation.isPending}
          isSavingPlan={savePlanMutation.isPending}
          isUpdatingStatus={updateTaskStatusMutation.isPending}
          onAppendNote={(taskId, note) => {
            appendPlanNoteMutation.mutate({ taskId, note });
          }}
          onDeleteTask={(taskId) => {
            const detail = taskDetailQuery.data;

            if (!detail) {
              return;
            }

            const confirmed = window.confirm(
              `Удалить задачу "${detail.task.title}"? План и сессия агента тоже будут удалены.`
            );

            if (!confirmed) {
              return;
            }

            deleteTaskMutation.mutate(taskId, {
              onSuccess({ deletedTaskId }) {
                const nextTask = visibleTasks.find((task) => task.id !== deletedTaskId) ?? null;

                setSelectedTaskId(nextTask?.id ?? null);
                setEditorMode("view");
              }
            });
          }}
          onSavePlan={(taskId, contentMd) => {
            savePlanMutation.mutate(
              {
                taskId,
                contentMd,
                source: "human"
              },
              {
                onSuccess() {
                  setEditorMode("view");
                }
              }
            );
          }}
          onSetEditorMode={setEditorMode}
          onUpdateStatus={(taskId, status) => {
            updateTaskStatusMutation.mutate({ taskId, status });
          }}
        />
      </div>
    </AppShell>
  );
}
