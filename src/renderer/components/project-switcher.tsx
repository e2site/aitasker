/*
Назначение: Рендерит переключатель проектов с подсветкой активного проекта и счетчиком задач.
Не входит: Создание задач, загрузка данных и панель деталей задачи.
*/
import type { ProjectRecord, TaskRecord } from "@/shared/contracts/desktop-api";
import { cn } from "@/renderer/components/ui/class-names";

export interface ProjectSwitcherProps {
  onSelectProject(projectId: string | null): void;
  projects: ProjectRecord[];
  selectedProjectId: string | null;
  tasks: TaskRecord[];
}

export function ProjectSwitcher(props: ProjectSwitcherProps) {
  if (props.projects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
        Проектов пока нет. Создайте первую задачу и укажите проект.
      </div>
    );
  }

  return (
    <div className="project-switcher">
      <button
        type="button"
        className={cn("project-chip", props.selectedProjectId === null && "project-chip--active")}
        onClick={() => props.onSelectProject(null)}
      >
        <span className="project-chip__title">Все проекты</span>
        <span className="project-chip__meta">
          {props.tasks.length} {props.tasks.length === 1 ? "задача" : props.tasks.length < 5 ? "задачи" : "задач"}
        </span>
      </button>

      {props.projects.map((project) => {
        const taskCount = props.tasks.filter((task) => task.projectId === project.id).length;

        return (
          <button
            key={project.id}
            type="button"
            className={cn("project-chip", props.selectedProjectId === project.id && "project-chip--active")}
            onClick={() => props.onSelectProject(project.id)}
          >
            <span className="project-chip__title">{project.name}</span>
            <span className="project-chip__meta">
              {taskCount} {taskCount === 1 ? "задача" : taskCount < 5 ? "задачи" : "задач"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
