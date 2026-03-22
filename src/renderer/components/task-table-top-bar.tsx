/*
Назначение: Рендерит топ-бар страницы задач — выбор проекта, поиск, фильтры по статусу, создание задач и действия в настройках проекта.
Не входит: Таблица задач, панель деталей и загрузка данных.
*/
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, FolderPlus, Search, Settings2, X } from "lucide-react";
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
import { PromptOverridesDialog } from "@/renderer/components/prompt-overrides-dialog";
import { TaskCreateForm } from "@/renderer/components/task-create-form";
import { cn } from "@/renderer/components/ui/class-names";
import { Button } from "@/renderer/components/ui/button";
import { useSetAppMenuTaskActions } from "@/renderer/app/app-menu-actions-context";
import { usePromptOverridesQuery } from "@/renderer/features/prompts/use-prompt-override-queries";
import { getProjectPromptVars, resolvePrompt } from "@/renderer/components/mcp-prompt-presets";
import { TASK_STATUS_LIST, getTaskStatusMeta } from "@/renderer/features/tasks/task-status-meta";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/renderer/components/ui/dropdown-menu";

export interface TaskTableTopBarProps {
  allTasks: TaskRecord[];
  filteredCount: number;
  isCreating: boolean;
  isCreatingProject: boolean;
  isExportingData: boolean;
  isImportingData: boolean;
  isUpdatingProject: boolean;
  onCreate(input: CreateTaskInput): void;
  onCreateProject(name: string): void;
  onExportData(): void;
  onImportData(): void;
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

function buildMcpEndpointHint(): string {
  return "http://127.0.0.1:39291/mcp";
}

export function TaskTableTopBar(props: TaskTableTopBarProps) {
  const setTaskActions = useSetAppMenuTaskActions();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showProjectCreateModal, setShowProjectCreateModal] = useState(false);
  const [showPromptOverridesModal, setShowPromptOverridesModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<null | { description: string; title: string }>(null);

  const overridesQuery = usePromptOverridesQuery();
  const overrides = overridesQuery.data ?? [];

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
    const vars = selectedProject
      ? getProjectPromptVars(selectedProject)
      : [
          { name: "projectId", value: "<укажи projectId>", placeholder: "project-id" },
          { name: "projectName", value: "<укажи проект>", placeholder: "«Название проекта»" },
          { name: "taskTitle", value: "", placeholder: "«Название задачи»" },
          { name: "taskId", value: "", placeholder: "«ID задачи»" },
          { name: "projectPath", value: "<укажи путь проекта>", placeholder: "«Путь к проекту»" },
          { name: "skillFilePath", value: "<укажи путь к SKILL.md>", placeholder: "«Путь к SKILL.md»" }
        ];
    const agentPrompt = resolvePrompt("agent-task-prompt", vars, overrides);
    copyPrompt(agentPrompt, "Промт скопирован", "Вставь его в агента и допиши задачу в конце");
  }

  function handleCopySkillPrompt() {
    if (!selectedProject) {
      return;
    }

    const vars = getProjectPromptVars(selectedProject);
    const skillPrompt = resolvePrompt("project-skill", vars, overrides);

    copyPrompt(
      skillPrompt,
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

  useEffect(() => {
    setTaskActions({
      isExportingData: props.isExportingData,
      isImportingData: props.isImportingData,
      onCopyAgentPrompt: handleCopyAgentPrompt,
      onOpenCreateModal: () => setShowCreateModal(true),
      onOpenPromptOverrides: () => setShowPromptOverridesModal(true),
      onExportData: props.onExportData,
      onImportData: props.onImportData
    });

    return () => setTaskActions(null);
  }, [
    props.isExportingData,
    props.isImportingData,
    props.onExportData,
    props.onImportData,
    setTaskActions,
    selectedProject,
    overrides
  ]);

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
          const count = props.allTasks.filter((task) => task.projectId === project.id).length;
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

        <button
          type="button"
          title="Новый проект"
          onClick={() => setShowProjectCreateModal(true)}
          className="inline-flex items-center justify-center rounded-xl border border-dashed border-slate-300 p-1.5 text-slate-400 transition hover:border-slate-400 hover:text-slate-600"
        >
          <FolderPlus className="size-3.5" />
        </button>

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
          {TASK_STATUS_LIST.map(({ value, filterLabel }) => {
            const active = props.selectedStatuses.includes(value);
            const meta = getTaskStatusMeta(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleStatus(value)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition",
                  active
                    ? cn(meta.badgeClass, "ring-1")
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                )}
              >
                {filterLabel}
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

      {/* Modal: prompt overrides */}
      <PromptOverridesDialog
        detail={null}
        isOpen={showPromptOverridesModal}
        onClose={() => setShowPromptOverridesModal(false)}
      />

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
