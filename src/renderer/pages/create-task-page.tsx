import { useAtom } from "jotai";
import { TaskCreateForm } from "@/renderer/components/task-create-form";
import { useProjectsQuery } from "@/renderer/features/projects/use-project-queries";
import { useCreateTaskMutation } from "@/renderer/features/tasks/use-task-queries";
import { selectedProjectIdAtom } from "@/renderer/features/projects/selected-project-id-state";
import { selectedTaskIdAtom } from "@/renderer/features/tasks/selected-task-id-state";
import { planEditorModeAtom } from "@/renderer/features/plans/plan-editor-mode-state";
import { currentPageAtom } from "@/renderer/features/navigation/current-page-state";

export function CreateTaskPage({ onClose }: { onClose(): void }) {
  const { data: projects = [] } = useProjectsQuery();
  const createTaskMutation = useCreateTaskMutation();
  const [selectedProjectId, setSelectedProjectId] = useAtom(selectedProjectIdAtom);
  const [, setSelectedTaskId] = useAtom(selectedTaskIdAtom);
  const [, setEditorMode] = useAtom(planEditorModeAtom);
  const [, setCurrentPage] = useAtom(currentPageAtom);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;
  const projectSuggestions = projects.map((p) => p.name).sort((a, b) => a.localeCompare(b, "ru-RU"));

  return (
    <TaskCreateForm
      isSubmitting={createTaskMutation.isPending}
      onCreate={(input) => {
        createTaskMutation.mutate(input, {
          onSuccess(detail) {
            setSelectedProjectId(detail.task.projectId);
            setSelectedTaskId(detail.task.id);
            setEditorMode("view");
            setCurrentPage("tasks");
            onClose();
          },
        });
      }}
      projectSuggestions={projectSuggestions}
      selectedProjectName={selectedProject?.name ?? null}
    />
  );
}
