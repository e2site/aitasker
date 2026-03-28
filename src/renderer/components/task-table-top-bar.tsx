/*
Назначение: Headless-компонент — регистрирует действия в app-menu и управляет модальным окном создания задачи и toast-уведомлениями.
Не входит: Таблица задач, поиск, фильтры, управление проектами.
*/
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, X } from "lucide-react";
import type {
  CreateTaskInput,
  ProjectRecord,
  TaskRecord,
  UpdateProjectProfileInput,
} from "@/shared/contracts/desktop-api";
import { ProjectCard } from "@/renderer/components/project-card";
import { PromptOverridesDialog } from "@/renderer/components/prompt-overrides-dialog";
import { TaskCreateForm } from "@/renderer/components/task-create-form";
import { Button } from "@/renderer/components/ui/button";
import { useSetAppMenuTaskActions } from "@/renderer/app/app-menu-actions-context";
import { usePromptOverridesQuery } from "@/renderer/features/prompts/use-prompt-override-queries";
import { getProjectPromptVars, resolvePrompt } from "@/renderer/components/mcp-prompt-presets";

export interface TaskTableTopBarProps {
  isCreating: boolean;
  isExportingData: boolean;
  isImportingData: boolean;
  isUpdatingProject: boolean;
  onCreate(input: CreateTaskInput): void;
  onExportData(): void;
  onImportData(): void;
  onUpdateProjectProfile(input: UpdateProjectProfileInput): void;
  projects: ProjectRecord[];
  selectedProjectId: string | null;
  // legacy compat — unused, kept to avoid breaking callers during migration
  allTasks?: TaskRecord[];
  filteredCount?: number;
  isCreatingProject?: boolean;
  onCreateProject?(name: string): void;
  onSelectProject?(projectId: string | null): void;
  onStatusFilterChange?(statuses: never[]): void;
  onSearchChange?(query: string): void;
  searchQuery?: string;
  selectedStatuses?: never[];
  totalCount?: number;
}

export interface TaskTableTopBarHandle {
  openCreateTask(): void;
  openProjectSettings(): void;
}

function buildMcpEndpointHint(): string {
  return "http://127.0.0.1:39291/mcp";
}

export const TaskTableTopBar = React.forwardRef<TaskTableTopBarHandle, TaskTableTopBarProps>(
  function TaskTableTopBar(props, ref) {
    const setTaskActions = useSetAppMenuTaskActions();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [showPromptOverridesModal, setShowPromptOverridesModal] = useState(false);
    const [toastMessage, setToastMessage] = useState<null | { description: string; title: string }>(null);

    const overridesQuery = usePromptOverridesQuery();
    const overrides = overridesQuery.data ?? [];

    const selectedProject = props.projects.find((p) => p.id === props.selectedProjectId) ?? null;
    const projectSuggestions = props.projects.map((p) => p.name).sort((a, b) => a.localeCompare(b, "ru-RU"));

    React.useImperativeHandle(ref, () => ({
      openCreateTask: () => setShowCreateModal(true),
      openProjectSettings: () => setShowProjectModal(true),
    }));

    function copyPrompt(prompt: string, title: string, description: string) {
      if (!navigator.clipboard?.writeText) return;
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
      if (!selectedProject) return;
      const vars = getProjectPromptVars(selectedProject);
      const skillPrompt = resolvePrompt("project-skill", vars, overrides);
      copyPrompt(skillPrompt, "Промт скопирован", "Вставь его в агента, чтобы он создал или обновил SKILL.md");
    }

    useEffect(() => {
      setTaskActions({
        isExportingData: props.isExportingData,
        isImportingData: props.isImportingData,
        onCopyAgentPrompt: handleCopyAgentPrompt,
        onOpenCreateModal: () => setShowCreateModal(true),
        onOpenPromptOverrides: () => setShowPromptOverridesModal(true),
        onExportData: props.onExportData,
        onImportData: props.onImportData,
      });
      return () => setTaskActions(null);
    }, [
      props.isExportingData,
      props.isImportingData,
      props.onExportData,
      props.onImportData,
      setTaskActions,
      selectedProject,
      overrides,
    ]);

    return (
      <>
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

        <PromptOverridesDialog
          detail={null}
          isOpen={showPromptOverridesModal}
          onClose={() => setShowPromptOverridesModal(false)}
        />

        {showProjectModal && selectedProject && (
          <Modal title="Настройки проекта" onClose={() => setShowProjectModal(false)}>
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Создать SKILL.md</p>
                    <p className="text-sm leading-6 text-muted-foreground">
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

              <div className="rounded-lg border p-4">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Как подключить MCP</p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Сначала запустите AITasker. По умолчанию MCP endpoint:{" "}
                      <code>{buildMcpEndpointHint()}</code>
                    </p>
                  </div>
                  <div className="space-y-2 rounded-md border p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Claude Code</p>
                    <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs">
                      <code>claude mcp add --transport http aitasker {buildMcpEndpointHint()}</code>
                    </pre>
                  </div>
                  <div className="space-y-2 rounded-md border p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Codex</p>
                    <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs">
                      <code>codex mcp add aitasker --url {buildMcpEndpointHint()}</code>
                    </pre>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
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

        {toastMessage && createPortal(
          <div className="fixed bottom-6 right-6 z-50 flex items-start gap-3 rounded-lg border bg-background px-4 py-3 shadow-xl">
            <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Copy className="size-3 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">{toastMessage.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{toastMessage.description}</p>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }
);

function Modal({
  title,
  size = "md",
  onClose,
  children,
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
      <div className={`relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-xl border bg-background p-6 shadow-2xl ${widthClass}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
