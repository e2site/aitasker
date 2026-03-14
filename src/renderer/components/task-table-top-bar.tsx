/*
Назначение: Рендерит топ-бар страницы задач — выбор проекта, поиск, фильтры по статусу, создание задач и действия в настройках проекта.
Не входит: Таблица задач, панель деталей и загрузка данных.
*/
import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Copy, FolderPlus, Plus, Search, Settings2, X } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type {
  CreateTaskInput,
  ProjectRecord,
  TaskRecord,
  TaskStatus,
  UpdateProjectProfileInput
} from "@/shared/contracts/desktop-api";
import { createProjectInputSchema } from "@/shared/contracts/desktop-api";
import { ProjectCard } from "@/renderer/components/project-card";
import { TaskCreateForm } from "@/renderer/components/task-create-form";
import { cn } from "@/renderer/components/ui/class-names";
import { Button } from "@/renderer/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/renderer/components/ui/dropdown-menu";

const STATUS_FILTERS: { status: TaskStatus; label: string }[] = [
  { status: "new", label: "Новые" },
  { status: "planning", label: "Планирование" },
  { status: "requires_clarification", label: "Уточнение" },
  { status: "implementation", label: "Реализация" },
  { status: "completed", label: "Выполнено" }
];

const STATUS_PILL_CLASSES: Record<TaskStatus, string> = {
  new: "bg-slate-100 text-slate-700 ring-slate-300",
  planning: "bg-sky-100 text-sky-800 ring-sky-300",
  requires_clarification: "bg-rose-100 text-rose-800 ring-rose-300",
  implementation: "bg-amber-100 text-amber-800 ring-amber-300",
  completed: "bg-emerald-100 text-emerald-800 ring-emerald-300"
};

export interface TaskTableTopBarProps {
  allTasks: TaskRecord[];
  filteredCount: number;
  isCreating: boolean;
  isCreatingProject: boolean;
  isUpdatingProject: boolean;
  onCreate(input: CreateTaskInput): void;
  onCreateProject(name: string): void;
  onSelectProject(projectId: string | null): void;
  onStatusFilterChange(statuses: TaskStatus[]): void;
  onSearchChange(query: string): void;
  onUpdateProjectProfile(input: UpdateProjectProfileInput): void;
  projects: ProjectRecord[];
  searchQuery: string;
  selectedProjectId: string | null;
  selectedStatuses: TaskStatus[];
  totalCount: number;
}

function buildProjectSkillPrompt(project: ProjectRecord): string {
  const projectPath = project.rootPath ?? "<укажи путь проекта>";
  const skillFilePath = project.skillFilePath ?? `${projectPath}\\SKILL.md`;
  const languages = project.languages.length ? project.languages.join(", ") : "не указаны";
  const description = project.description.trim() || "Описание проекта пока не заполнено";

  return `Активируй в aitasker проект "${project.name}" (${project.id}).
Проверь карточку проекта и при необходимости уточни rootPath, languages и skillFilePath.
Затем создай или обнови файл SKILL.md по пути "${skillFilePath}".

Контекст проекта:
- Название: ${project.name}
- Путь: ${projectPath}
- Языки: ${languages}
- Описание: ${description}

Что должно быть в SKILL.md:
1. Краткое назначение проекта и рабочий контекст.
2. Как агенту работать с MCP AITasker именно в этом проекте.
3. Как активировать проект и проверять его карточку.
4. Как создавать задачи через MCP и какие поля обязательны.
5. Как искать задачи, читать задачу и получать текущий план.
6. Как создавать и обновлять план через save_plan.
7. Что открытые вопросы передаются отдельно от markdown-плана через openQuestions.
8. Как отвечать на открытые вопросы и что после ответа они переходят в обсуждение.
9. Как использовать append_plan_extension и append_plan_improvement для переписки по задаче.
10. Как использовать get_plan_extension и get_plan_improvement для точечного чтения обсуждения.
11. Как сжимать переписку обратно в план через consolidate_plan_discussion.
12. Какие статусы задач доступны и что через интерфейс статус блокируется, пока есть открытые вопросы.
13. Практические правила работы: сначала читать проект и задачу, потом менять план, не плодить лишние ревизии, фиксировать решения в обсуждении.

После создания файла:
- при необходимости сохрани путь к SKILL.md в карточке проекта через update_project_profile;
- кратко отчитайся, что добавлено в SKILL.md.`;
}

function buildMcpEndpointHint(): string {
  return "http://127.0.0.1:39291/mcp";
}

export function TaskTableTopBar(props: TaskTableTopBarProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showProjectCreateModal, setShowProjectCreateModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<null | { description: string; title: string }>(null);

  const selectedProject = props.projects.find((p) => p.id === props.selectedProjectId) ?? null;
  const projectSuggestions = props.projects.map((p) => p.name).sort((a, b) => a.localeCompare(b, "ru-RU"));

  function copyPrompt(prompt: string, title: string, description: string) {
    if (!navigator.clipboard?.writeText) {
      return;
    }

    void navigator.clipboard.writeText(prompt).then(() => {
      setToastMessage({ title, description });
      window.setTimeout(() => {
        setToastMessage((current) =>
          current?.title === title && current.description === description ? null : current
        );
      }, 3000);
    });
  }

  function handleCopyAgentPrompt() {
    const projectName = selectedProject?.name ?? "<укажи проект>";
    const agentPrompt =
      `Активируй в aitasker проект "${projectName}". ` +
      `Распланируй задачу, сохрани план через MCP и переведи задачу в статус planning. Выполнять сразу не надо. ` +
      `Задача: `;

    copyPrompt(agentPrompt, "Промт скопирован", "Вставь его в агента и допиши задачу в конце");
  }

  function handleCopySkillPrompt() {
    if (!selectedProject) {
      return;
    }

    copyPrompt(
      buildProjectSkillPrompt(selectedProject),
      "Промт скопирован",
      "Вставь его в агента, чтобы он создал или обновил SKILL.md"
    );
  }

  function toggleStatus(status: TaskStatus) {
    const next = props.selectedStatuses.includes(status)
      ? props.selectedStatuses.filter((s) => s !== status)
      : [...props.selectedStatuses, status];
    props.onStatusFilterChange(next);
  }

  return (
    <div className="app-card space-y-4">
      {/* Row 1: project switcher + create button */}
      <div className="flex flex-wrap items-center gap-2">
        {/* All projects chip */}
        <button
          type="button"
          onClick={() => props.onSelectProject(null)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition",
            props.selectedProjectId === null
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
          )}
        >
          Все проекты
          <span className="rounded-full bg-white/20 px-1.5 text-xs">
            {props.allTasks.length}
          </span>
        </button>

        {props.projects.map((project) => {
          const count = props.allTasks.filter((t) => t.projectId === project.id).length;
          const isActive = props.selectedProjectId === project.id;
          return (
            <div key={project.id} className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => props.onSelectProject(project.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition",
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {project.name}
                <span className={cn("rounded-full px-1.5 text-xs", isActive ? "bg-white/20" : "bg-slate-100")}>
                  {count}
                </span>
              </button>
              {isActive && (
                <button
                  type="button"
                  title="Настройки проекта"
                  onClick={() => setShowProjectModal(true)}
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <Settings2 className="size-3.5" />
                </button>
              )}
            </div>
          );
        })}

        {/* Кнопка создания нового проекта */}
        <button
          type="button"
          title="Новый проект"
          onClick={() => setShowProjectCreateModal(true)}
          className="inline-flex items-center justify-center rounded-xl border border-dashed border-slate-300 p-1.5 text-slate-400 transition hover:border-slate-400 hover:text-slate-600"
        >
          <FolderPlus className="size-3.5" />
        </button>

        {/* Кнопка с дропдауном: создать задачу / создать в агенте */}
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm">
                <Plus className="size-4" />
                Создать задачу
                <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-white p-1.5 shadow-lg">
              <DropdownMenuItem
                onClick={() => setShowCreateModal(true)}
                className="gap-2 rounded-lg px-3 py-2 text-sm"
              >
                <Plus className="size-4 text-slate-500" />
                Создать задачу
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleCopyAgentPrompt}
                className="gap-2 rounded-lg px-3 py-2 text-sm"
              >
                <Copy className="size-4 text-slate-500" />
                Создать задачу в агенте
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Row 2: search + status filters + counter */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-48 flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Поиск задач..."
            value={props.searchQuery}
            onChange={(e) => props.onSearchChange(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-300"
          />
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map(({ status, label }) => {
            const active = props.selectedStatuses.includes(status);
            return (
              <button
                key={status}
                type="button"
                onClick={() => toggleStatus(status)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition",
                  active
                    ? cn(STATUS_PILL_CLASSES[status], "ring-1")
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Counter */}
        <span className="ml-auto text-xs text-slate-400">
          {props.filteredCount === props.totalCount
            ? `${props.totalCount} задач`
            : `${props.filteredCount} из ${props.totalCount}`}
        </span>
      </div>

      {/* Modal: create task */}
      {showCreateModal && (
        <Modal title="Новая задача" size="xl" onClose={() => setShowCreateModal(false)}>
          <TaskCreateForm
            isSubmitting={props.isCreating}
            onCreate={(input) => {
              props.onCreate(input);
              setShowCreateModal(false);
            }}
            projectSuggestions={projectSuggestions}
            selectedProjectName={selectedProject?.name ?? null}
          />
        </Modal>
      )}

      {/* Toast: промт скопирован */}
      {toastMessage && createPortal(
        <div className="fixed bottom-6 right-6 z-50 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3 shadow-xl">
          <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <Copy className="size-3 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{toastMessage.title}</p>
            <p className="mt-0.5 text-xs text-slate-500">{toastMessage.description}</p>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: create project */}
      {showProjectCreateModal && (
        <Modal title="Новый проект" onClose={() => setShowProjectCreateModal(false)}>
          <ProjectCreateForm
            isSubmitting={props.isCreatingProject}
            onCreate={(name) => {
              props.onCreateProject(name);
              setShowProjectCreateModal(false);
            }}
          />
        </Modal>
      )}

      {/* Modal: project settings */}
      {showProjectModal && selectedProject && (
        <Modal title="Настройки проекта" onClose={() => setShowProjectModal(false)}>
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">Создать SKILL.md</p>
                  <p className="text-sm leading-6 text-slate-600">
                    Скопируйте готовый prompt для AI-агента. Он создаст или обновит `SKILL.md` и опишет
                    работу с MCP: проекты, задачи, планы, открытые вопросы, обсуждение и сжатие переписки.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={handleCopySkillPrompt}>
                  <Copy className="size-4" />
                  Создать SKILLS
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">Как подключить MCP</p>
                  <p className="text-sm leading-6 text-slate-600">
                    Сначала запустите AITasker. По умолчанию MCP endpoint:
                    {" "}
                    <code>{buildMcpEndpointHint()}</code>
                  </p>
                </div>

                <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Claude Code</p>
                  <pre className="overflow-x-auto rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    <code>claude mcp add --transport http aitasker {buildMcpEndpointHint()}</code>
                  </pre>
                </div>

                <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Codex</p>
                  <pre className="overflow-x-auto rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    <code>codex mcp add aitasker --url {buildMcpEndpointHint()}</code>
                  </pre>
                </div>

                <p className="text-xs leading-5 text-slate-500">
                  Если в приложении переопределен порт через `AITASKER_MCP_PORT`, замените URL в командах на свой endpoint.
                </p>
              </div>
            </div>

            <ProjectCard
              project={selectedProject}
              isUpdating={props.isUpdatingProject}
              onSave={(input) => {
                props.onUpdateProjectProfile(input);
                setShowProjectModal(false);
              }}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

interface ProjectCreateFormProps {
  isSubmitting: boolean;
  onCreate(name: string): void;
}

function ProjectCreateForm({ isSubmitting, onCreate }: ProjectCreateFormProps) {
  const form = useForm<{ name: string }>({
    resolver: zodResolver(createProjectInputSchema),
    defaultValues: { name: "" }
  });

  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit((values) => onCreate(values.name))}
    >
      <div>
        <label className="app-label" htmlFor="project-name">
          Название проекта
        </label>
        <input
          id="project-name"
          className="app-input mt-2"
          placeholder="Например, Мобильное приложение"
          autoFocus
          {...form.register("name")}
        />
        {form.formState.errors.name ? (
          <p className="app-error">{form.formState.errors.name.message}</p>
        ) : null}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Создание..." : "Создать проект"}
      </Button>
    </form>
  );
}

function Modal({
  title,
  size = "md",
  onClose,
  children
}: {
  title: string;
  size?: "md" | "xl";
  onClose(): void;
  children: React.ReactNode;
}) {
  const widthClass = size === "xl" ? "max-w-5xl" : "max-w-lg";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl ${widthClass}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
