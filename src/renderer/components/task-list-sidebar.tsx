/*
Назначение: Рендерит левый сайдбар с созданием задач и разбивкой списка по проектам.
Не входит: Отрисовка деталей задачи и редактирование плана.
*/
import type { CreateTaskInput, ProjectRecord, TaskRecord, TaskStatus, UpdateProjectProfileInput } from "@/shared/contracts/desktop-api";
import { ProjectCard } from "@/renderer/components/project-card";
import { ProjectSwitcher } from "@/renderer/components/project-switcher";
import { TaskCreateForm } from "@/renderer/components/task-create-form";
import { TaskStatusBadge } from "@/renderer/components/task-status-badge";
import { cn } from "@/renderer/components/ui/class-names";

export interface TaskListSidebarProps {
  allTasks: TaskRecord[];
  isCreating: boolean;
  isUpdatingProject: boolean;
  onCreate(input: CreateTaskInput): void;
  onSelectProject(projectId: string | null): void;
  onSelect(taskId: string): void;
  onUpdateProjectProfile(input: UpdateProjectProfileInput): void;
  projects: ProjectRecord[];
  selectedProjectId: string | null;
  selectedTaskId: string | null;
  tasks: TaskRecord[];
}

const STATUS_GROUPS: { status: TaskStatus; label: string }[] = [
  { status: "new", label: "Новые" },
  { status: "planning", label: "Планирование" },
  { status: "requires_clarification", label: "Требуют уточнений" },
  { status: "implementation", label: "Реализация" },
  { status: "completed", label: "Выполнено" }
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function TaskListSidebar(props: TaskListSidebarProps) {
  const projectSuggestions = props.projects.map((project) => project.name).sort((a, b) => a.localeCompare(b, "ru-RU"));
  const selectedProject = props.projects.find((project) => project.id === props.selectedProjectId) ?? null;
  const grouped = STATUS_GROUPS.map((group) => ({
    ...group,
    tasks: props.tasks.filter((task) => task.status === group.status)
  })).filter((group) => group.tasks.length > 0);

  return (
    <aside className="app-card flex h-full flex-col gap-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Проекты</h1>
        <p className="text-xs text-slate-500">
          {props.projects.length}{" "}
          {props.projects.length === 1 ? "проект" : props.projects.length < 5 ? "проекта" : "проектов"} ·{" "}
          {props.allTasks.length}{" "}
          {props.allTasks.length === 1 ? "задача" : props.allTasks.length < 5 ? "задачи" : "задач"}
        </p>
      </div>

      <ProjectSwitcher
        projects={props.projects}
        selectedProjectId={props.selectedProjectId}
        tasks={props.allTasks}
        onSelectProject={props.onSelectProject}
      />

      <TaskCreateForm
        isSubmitting={props.isCreating}
        onCreate={props.onCreate}
        projectSuggestions={projectSuggestions}
        selectedProjectName={selectedProject?.name ?? null}
      />

      <div className="flex-1 overflow-y-auto">
        {selectedProject ? (
          <ProjectCard
            project={selectedProject}
            isUpdating={props.isUpdatingProject}
            onSave={props.onUpdateProjectProfile}
          />
        ) : null}

        {props.selectedProjectId === null ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-sm font-semibold text-slate-900">Все проекты</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Показаны все задачи из всех проектов. Выберите проект выше, если нужен узкий контекст.
            </p>
          </div>
        ) : null}

        {!selectedProject && props.selectedProjectId !== null ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
            Выберите проект, чтобы увидеть его задачи.
          </div>
        ) : null}

        {props.selectedProjectId === null && props.tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
            Пока нет задач. Создайте первую задачу.
          </div>
        ) : null}

        {selectedProject && props.tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
            В этом проекте пока нет задач. Создайте первую задачу для "{selectedProject.name}".
          </div>
        ) : null}

        {grouped.map((group) => (
          <div key={group.status}>
            <p className="task-group-header">{group.label}</p>
            <div className="space-y-1.5">
              {group.tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className={cn(
                    "task-card",
                    `task-card--${task.status}`,
                    props.selectedTaskId === task.id && "task-card--active"
                  )}
                  onClick={() => props.onSelect(task.id)}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="task-status-dot mt-1.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-medium text-slate-800">{task.title}</p>
                        <span className="flex-shrink-0 text-xs text-slate-400">{formatDate(task.updatedAt)}</span>
                      </div>
                      {task.description ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{task.description}</p>
                      ) : null}
                      <div className="mt-1.5">
                        <TaskStatusBadge status={task.status} />
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
