/*
Назначение: Собирает хлебные крошки верхнего layout на основе текущей страницы и выбранных сущностей и инкапсулирует переходы по ним.
Не входит: Отрисовка header, загрузка drawer-контента и управление боковой панелью.
*/
import { useAtom } from "jotai";
import { planEditorModeAtom } from "@/renderer/features/plans/plan-editor-mode-state";
import { selectedProjectIdAtom } from "@/renderer/features/projects/selected-project-id-state";
import { useProjectsQuery } from "@/renderer/features/projects/use-project-queries";
import { currentPageAtom } from "@/renderer/features/navigation/current-page-state";
import { drawerPageAtom } from "@/renderer/features/navigation/drawer-state";
import { selectedTaskIdAtom } from "@/renderer/features/tasks/selected-task-id-state";
import { useTasksQuery } from "@/renderer/features/tasks/use-task-queries";

export interface AppBreadcrumbItem {
  id: string;
  label: string;
  hideOnMobile?: boolean;
  onClick?(): void;
}

export function useAppBreadcrumbs(): AppBreadcrumbItem[] {
  const { data: projects = [] } = useProjectsQuery();
  const { data: tasks = [] } = useTasksQuery();
  const [currentPage, setCurrentPage] = useAtom(currentPageAtom);
  const [selectedProjectId, setSelectedProjectId] = useAtom(selectedProjectIdAtom);
  const [selectedTaskId, setSelectedTaskId] = useAtom(selectedTaskIdAtom);
  const [, setDrawerPage] = useAtom(drawerPageAtom);
  const [, setEditorMode] = useAtom(planEditorModeAtom);

  if (currentPage === "resources") {
    return [{ id: "resources", label: "Ресурсы" }];
  }

  if (currentPage === "project-hints") {
    return [{ id: "project-hints", label: "Подсказки" }];
  }

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ??
    projects.find((project) => project.id === selectedTask?.projectId) ??
    null;

  const items: AppBreadcrumbItem[] = [
    {
      id: "tasks",
      label: "Задачи",
      hideOnMobile: selectedProject !== null,
      onClick: () => {
        setCurrentPage("tasks");
        setDrawerPage(null);
        setSelectedProjectId(null);
        setSelectedTaskId(null);
        setEditorMode("view");
      }
    }
  ];

  if (selectedProject) {
    items.push({
      id: `project-${selectedProject.id}`,
      label: selectedProject.name,
      hideOnMobile: selectedTask !== null,
      onClick: () => {
        setCurrentPage("tasks");
        setDrawerPage(null);
        setSelectedProjectId(selectedProject.id);
        setSelectedTaskId(null);
        setEditorMode("view");
      }
    });
  }

  if (selectedTask) {
    items.push({
      id: `task-${selectedTask.id}`,
      label: selectedTask.title
    });
  }

  return items;
}
