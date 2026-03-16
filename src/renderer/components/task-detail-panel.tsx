/*
Назначение: Показывает выбранную задачу в Jira-like layout, включая статус, план, быстрые MCP-действия и ограничения интерфейса при незакрытых вопросах.
Не входит: Отрисовка списка задач и форма создания задач.
*/
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, ChevronUp, Link, Pencil, Eye, Trash2, FilePlus, X } from "lucide-react";
import { LinkResourceDialog } from "@/renderer/components/link-resource-dialog";
import { LinkTaskDialog } from "@/renderer/components/link-task-dialog";
import { MarkdownPlanEditor } from "@/renderer/editors/markdown-plan-editor";
import { MarkdownPlanViewer } from "@/renderer/components/markdown-plan-viewer";
import { McpPlanningPanel } from "@/renderer/components/mcp-planning-panel";
import { McpPromptShortcuts } from "@/renderer/components/mcp-prompt-shortcuts";
import { TaskPlanWorkspace } from "@/renderer/components/task-plan-workspace";
import type { TaskDetail, TaskStatus } from "@/shared/contracts/desktop-api";
import { parseManagedPlanContent } from "@/shared/plans/managed-plan-content";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/renderer/components/ui/dropdown-menu";

type Tab = "plan" | "mcp" | "session";

const TABS: { id: Tab; label: string }[] = [
  { id: "plan", label: "План" },
  { id: "mcp", label: "MCP workflow" },
  { id: "session", label: "Сессия" },
];

const TASK_STATUSES: { label: string; value: TaskStatus }[] = [
  { value: "new", label: "Новая" },
  { value: "planning", label: "Планирование" },
  { value: "requires_clarification", label: "Требует уточнений" },
  { value: "implementation", label: "Реализация" },
  { value: "testing", label: "Тестирование" },
  { value: "completed", label: "Выполнено" },
];

const STATUS_DOT_COLORS: Record<TaskStatus, string> = {
  new: "bg-slate-400",
  planning: "bg-sky-500",
  requires_clarification: "bg-rose-500",
  implementation: "bg-amber-500",
  testing: "bg-purple-500",
  completed: "bg-emerald-500",
};

const STATUS_TEXT_COLORS: Record<TaskStatus, string> = {
  new: "text-slate-500",
  planning: "text-sky-600",
  requires_clarification: "text-rose-600",
  implementation: "text-amber-600",
  testing: "text-purple-600",
  completed: "text-emerald-600",
};

// Цвета фона бейджей в выпадающем списке
const STATUS_BADGE_CLASSES: Record<TaskStatus, string> = {
  new: "bg-slate-100 text-slate-700 hover:bg-slate-200",
  planning: "bg-sky-100 text-sky-800 hover:bg-sky-200",
  requires_clarification: "bg-rose-100 text-rose-800 hover:bg-rose-200",
  implementation: "bg-amber-100 text-amber-800 hover:bg-amber-200",
  testing: "bg-purple-100 text-purple-800 hover:bg-purple-200",
  completed: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
};

export interface TaskDetailPanelProps {
  detail: TaskDetail | null;
  editorMode: "view" | "edit";
  isAnsweringPlanQuestion: boolean;
  isAppendingPlanExtension: boolean;
  isAppendingPlanImprovement: boolean;
  isDeletingTask: boolean;
  isLinkingResource: boolean;
  isLinkingTask: boolean;
  isRestoringRevision: boolean;
  isSavingPlan: boolean;
  isUnlinkingResource: boolean;
  isUnlinkingTask: boolean;
  isUpdatingStatus: boolean;
  isUpdatingTask: boolean;
  onAnswerPlanQuestion(taskId: string, questionId: string, answer: string): void;
  onAppendPlanExtension(taskId: string, content: string): void;
  onAppendPlanImprovement(taskId: string, content: string): void;
  onDeleteTask(taskId: string): void;
  onLinkResource(resourceId: string, comment: string): void;
  onLinkTask(targetTaskId: string, comment: string): void;
  onRestorePlanRevision(taskId: string, revisionId: string): void;
  onSavePlan(taskId: string, contentMd: string): void;
  onSetEditorMode(mode: "view" | "edit"): void;
  onUnlinkResource(linkId: string): void;
  onUnlinkTask(linkId: string): void;
  onUpdateStatus(taskId: string, status: TaskStatus): void;
  onUpdateTask(taskId: string, fields: { title?: string; description?: string }): void;
}

function MetaField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </span>
      <span className="text-sm text-slate-700">
        {value || <em className="not-italic text-slate-300">нет</em>}
      </span>
    </div>
  );
}

function StatusDropdown({
  disabled,
  hasOpenQuestions,
  onUpdate,
  status,
}: {
  disabled: boolean;
  hasOpenQuestions: boolean;
  onUpdate(s: TaskStatus): void;
  status: TaskStatus;
}) {
  const current = TASK_STATUSES.find((s) => s.value === status);

  const isStatusLockedByQuestions = (nextStatus: TaskStatus) =>
    hasOpenQuestions && nextStatus !== status && nextStatus !== "requires_clarification";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={`inline-flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50 ${STATUS_TEXT_COLORS[status]}`}
        >
          <span className="flex items-center gap-2">
            <span className={`size-2 rounded-full ${STATUS_DOT_COLORS[status]}`} />
            {current?.label}
          </span>
          <ChevronDown className="size-3.5 text-slate-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width] bg-white p-1.5 shadow-lg">
        {TASK_STATUSES.map((s) => (
          <DropdownMenuItem
            key={s.value}
            disabled={isStatusLockedByQuestions(s.value)}
            onClick={() => onUpdate(s.value)}
            className={`mb-1 rounded-lg px-3 py-2 text-sm font-medium last:mb-0 ${STATUS_BADGE_CLASSES[s.value]}`}
          >
            <span className={`size-2 rounded-full ${STATUS_DOT_COLORS[s.value]}`} />
            {s.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TaskDetailPanel(props: TaskDetailPanelProps) {
  const [draftPlan, setDraftPlan] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("plan");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkResourceDialogOpen, setLinkResourceDialogOpen] = useState(false);

  useEffect(() => {
    setDraftPlan(props.detail?.plan ? parseManagedPlanContent(props.detail.plan.contentMd).baseContentMd : "");
    setActiveTab("plan");
    setEditingTitle(false);
    setEditingDescription(false);
    setDescriptionExpanded(false);
    setLinkDialogOpen(false);
    setLinkResourceDialogOpen(false);
  }, [props.detail?.plan?.contentMd, props.detail?.task.id]);

  if (!props.detail) {
    return (
      <section className="app-card flex min-h-[720px] items-center justify-center text-center text-slate-500">
        Выберите задачу слева или создайте новую, чтобы открыть карточку и план.
      </section>
    );
  }

  const detail = props.detail;
  const openQuestionsCount = detail.plan ? parseManagedPlanContent(detail.plan.contentMd).questions.length : 0;
  const hasOpenQuestions = openQuestionsCount > 0;
  const busy =
    props.isDeletingTask || props.isSavingPlan || props.isUpdatingStatus || props.isRestoringRevision;

  return (
    <section className="app-card min-h-[720px] grid grid-cols-1 lg:grid-cols-[1fr_260px]">
      {/* LEFT — основное тело */}
      <div className="flex min-w-0 flex-col pr-0 lg:pr-6">
        {/* Breadcrumb + icon toolbar */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="text-xs text-slate-400">
            {detail.task.projectName} <span className="mx-1">/</span> {detail.task.title}
          </p>
          <div className="flex items-center gap-1">
            {detail.plan ? (
              <button
                type="button"
                title={props.editorMode === "view" ? "Редактировать план" : "Просмотр"}
                disabled={props.isDeletingTask}
                onClick={() => props.onSetEditorMode(props.editorMode === "view" ? "edit" : "view")}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-40"
              >
                {props.editorMode === "view" ? <Pencil className="size-4" /> : <Eye className="size-4" />}
              </button>
            ) : (
              <button
                type="button"
                title="Создать план вручную"
                disabled={props.isDeletingTask}
                onClick={() => props.onSetEditorMode("edit")}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-40"
              >
                <FilePlus className="size-4" />
              </button>
            )}
            <button
              type="button"
              title="Удалить задачу"
              disabled={busy}
              onClick={() => props.onDeleteTask(detail.task.id)}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:pointer-events-none disabled:opacity-40"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>

        {/* Short ID + статус-дропдаун */}
        <div className="mb-3 flex items-center gap-3">
          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500">
            TASK-{detail.task.id.slice(0, 8).toUpperCase()}
          </span>
          <div className="w-48">
            <StatusDropdown
              status={detail.task.status}
              disabled={busy}
              hasOpenQuestions={hasOpenQuestions}
              onUpdate={(s) => props.onUpdateStatus(detail.task.id, s)}
            />
          </div>
        </div>

        {hasOpenQuestions ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            У задачи есть открытые вопросы: {openQuestionsCount}. Через интерфейс можно выставить только статус
            {" "}
            <strong>Требует уточнений</strong>
            {" "}
            или оставить текущий статус, пока все вопросы не будут закрыты в обсуждении.
          </div>
        ) : null}

        {/* Заголовок — inline-редактируемый */}
        {editingTitle ? (
          <input
            autoFocus
            className="mb-2 w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-2xl font-semibold tracking-tight text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            value={titleDraft}
            disabled={props.isUpdatingTask}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              const trimmed = titleDraft.trim();
              if (trimmed.length >= 3 && trimmed !== detail.task.title) {
                props.onUpdateTask(detail.task.id, { title: trimmed });
              }
              setEditingTitle(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.currentTarget.blur(); }
              if (e.key === "Escape") { setEditingTitle(false); }
            }}
          />
        ) : (
          <h1
            className="group mb-2 cursor-text rounded-lg px-2 py-1 text-2xl font-semibold tracking-tight text-slate-950 hover:bg-slate-50"
            onClick={() => {
              setTitleDraft(detail.task.title);
              setEditingTitle(true);
            }}
            title="Нажмите, чтобы редактировать"
          >
            {detail.task.title}
            <Pencil className="ml-2 inline size-3.5 text-slate-300 opacity-0 transition group-hover:opacity-100" />
          </h1>
        )}

        {/* Описание */}
        {editingDescription ? (
          <div className="mb-5">
            <MarkdownPlanEditor
              value={descriptionDraft}
              onChange={setDescriptionDraft}
              resetKey={detail.task.id}
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingDescription(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={props.isUpdatingTask}
                onClick={() => {
                  const trimmed = descriptionDraft.trim();
                  if (trimmed.length >= 12 && trimmed !== detail.task.description) {
                    props.onUpdateTask(detail.task.id, { description: trimmed });
                  }
                  setEditingDescription(false);
                }}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
              >
                {props.isUpdatingTask ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-5">
            {detail.task.description ? (
              <>
                <div
                  className="relative"
                  onClick={detail.task.status === "new" ? () => {
                    setDescriptionDraft(detail.task.description);
                    setEditingDescription(true);
                  } : undefined}
                  style={detail.task.status === "new" ? { cursor: "text" } : undefined}
                  title={detail.task.status === "new" ? "Нажмите, чтобы редактировать" : undefined}
                >
                  <div style={descriptionExpanded ? undefined : { maxHeight: "8rem", overflow: "hidden" }}>
                    <MarkdownPlanViewer contentMd={detail.task.description} />
                  </div>
                  {!descriptionExpanded && detail.task.description.split("\n").length > 5 && (
                    <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent" />
                  )}
                </div>
                <div className="mt-1 flex items-center gap-3">
                  {detail.task.description.split("\n").length > 5 && (
                    <button
                      type="button"
                      onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                      className="flex items-center gap-1 text-xs text-slate-400 transition hover:text-slate-600"
                    >
                      {descriptionExpanded ? (
                        <><ChevronUp className="size-3" /> Свернуть</>
                      ) : (
                        <><ChevronDown className="size-3" /> Развернуть</>
                      )}
                    </button>
                  )}
                  {detail.task.status === "new" && (
                    <button
                      type="button"
                      onClick={() => {
                        setDescriptionDraft(detail.task.description);
                        setEditingDescription(true);
                      }}
                      className="flex items-center gap-1 text-xs text-slate-400 transition hover:text-slate-600"
                    >
                      <Pencil className="size-3" /> Редактировать
                    </button>
                  )}
                </div>
              </>
            ) : detail.task.status === "new" ? (
              <p
                className="cursor-text rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-50"
                onClick={() => {
                  setDescriptionDraft("");
                  setEditingDescription(true);
                }}
              >
                Нажмите, чтобы добавить описание...
              </p>
            ) : (
              <div />
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-0 border-b border-slate-200 mb-5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1">
          {activeTab === "plan" ? (
            <TaskPlanWorkspace
            detail={detail}
            draftPlan={draftPlan}
            editorMode={props.editorMode}
            isAnsweringPlanQuestion={props.isAnsweringPlanQuestion}
            isAppendingPlanExtension={props.isAppendingPlanExtension}
            isAppendingPlanImprovement={props.isAppendingPlanImprovement}
            onAnswerPlanQuestion={props.onAnswerPlanQuestion}
            isDeletingTask={props.isDeletingTask}
              isRestoringRevision={props.isRestoringRevision}
              isSavingPlan={props.isSavingPlan}
              onAppendPlanExtension={props.onAppendPlanExtension}
              onAppendPlanImprovement={props.onAppendPlanImprovement}
              onChangeDraftPlan={setDraftPlan}
              onRestoreRevision={(revisionId) => props.onRestorePlanRevision(detail.task.id, revisionId)}
              onSavePlan={props.onSavePlan}
              onSetEditorMode={props.onSetEditorMode}
            />
          ) : null}

          {activeTab === "mcp" ? <McpPlanningPanel detail={detail} /> : null}

          {activeTab === "session" ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="app-label">Agent session</p>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <p>Provider: {detail.agentSession?.provider ?? "mcp"}</p>
                  <p>Status: {detail.agentSession?.status ?? "idle"}</p>
                  <p>MCP-ready: current task and plan are exposed through tools, resources, and prompt workflow</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* RIGHT — метаданные */}
      <aside className="mt-6 flex flex-col gap-4 border-t border-slate-100 pt-6 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        <MetaField label="Проект" value={detail.task.projectName} />

        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Статус
          </span>
          <StatusDropdown
            status={detail.task.status}
            disabled={busy}
            hasOpenQuestions={hasOpenQuestions}
            onUpdate={(s) => props.onUpdateStatus(detail.task.id, s)}
          />
        </div>

        <MetaField
          label="Создана"
          value={new Date(detail.task.createdAt).toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        />
        <MetaField
          label="Обновлена"
          value={new Date(detail.task.updatedAt).toLocaleString("ru-RU")}
        />
        <MetaField
          label="ID"
          value={<span className="font-mono text-xs">{detail.task.id}</span>}
        />
        <MetaField label="Путь" value={detail.project.rootPath} />
        <MetaField
          label="Языки"
          value={detail.project.languages.length ? detail.project.languages.join(", ") : null}
        />
        <MetaField label="SKILL.md" value={detail.project.skillFilePath} />
        <McpPromptShortcuts detail={detail} />

        {/* Связанные задачи */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Связанные задачи
          </span>

          {detail.linkedTasks.length === 0 ? (
            <p className="text-xs text-slate-400">Нет привязанных задач</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {detail.linkedTasks.map((linked) => (
                <div
                  key={linked.id}
                  className="group flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <span className="mt-0.5 shrink-0 text-slate-400">
                    {linked.direction === "outgoing" ? (
                      <ArrowRight className="size-3" />
                    ) : (
                      <ArrowLeft className="size-3" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-700 line-clamp-2">{linked.title}</p>
                    {linked.comment && (
                      <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">{linked.comment}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    title="Отвязать задачу"
                    disabled={props.isUnlinkingTask}
                    onClick={() => props.onUnlinkTask(linked.id)}
                    className="shrink-0 rounded p-0.5 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 disabled:pointer-events-none"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setLinkDialogOpen(true)}
            className="flex items-center gap-1.5 self-start rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <Link className="size-3" />
            Привязать задачу
          </button>
        </div>

        {/* Привязанные ресурсы */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Ресурсы
          </span>

          {detail.linkedResources.length === 0 ? (
            <p className="text-xs text-slate-400">Нет привязанных ресурсов</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {detail.linkedResources.map((linked) => (
                <div
                  key={linked.id}
                  className="group flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <BookOpen className="mt-0.5 size-3 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-700 line-clamp-2">{linked.name}</p>
                    {linked.comment && (
                      <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">{linked.comment}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    title="Отвязать ресурс"
                    disabled={props.isUnlinkingResource}
                    onClick={() => props.onUnlinkResource(linked.id)}
                    className="shrink-0 rounded p-0.5 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 disabled:pointer-events-none"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setLinkResourceDialogOpen(true)}
            className="flex items-center gap-1.5 self-start rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <BookOpen className="size-3" />
            Привязать ресурс
          </button>
        </div>
      </aside>

      <LinkTaskDialog
        currentTaskId={detail.task.id}
        existingLinkedTaskIds={detail.linkedTasks.map((l) => l.taskId)}
        isLinking={props.isLinkingTask}
        isOpen={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        onLink={(targetTaskId, comment) => {
          props.onLinkTask(targetTaskId, comment);
          setLinkDialogOpen(false);
        }}
      />

      <LinkResourceDialog
        existingLinkedResourceIds={detail.linkedResources.map((r) => r.resourceId)}
        isLinking={props.isLinkingResource}
        isOpen={linkResourceDialogOpen}
        onClose={() => setLinkResourceDialogOpen(false)}
        onLink={(resourceId, comment) => {
          props.onLinkResource(resourceId, comment);
          setLinkResourceDialogOpen(false);
        }}
      />
    </section>
  );
}
