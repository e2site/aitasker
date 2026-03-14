/*
Назначение: Показывает выбранную задачу, ее проектный контекст, подсказки по MCP и текущий Markdown-план.
Не входит: Отрисовка списка задач и форма создания задач.
*/
import { useEffect, useState } from "react";
import type { TaskDetail, TaskStatus } from "@/shared/contracts/desktop-api";
import { Button } from "@/renderer/components/ui/button";
import { MarkdownPlanViewer } from "@/renderer/components/markdown-plan-viewer";
import { TaskStatusBadge } from "@/renderer/components/task-status-badge";
import { MarkdownPlanEditor } from "@/renderer/editors/markdown-plan-editor";

type Tab = "plan" | "mcp" | "session" | "details";

const TABS: { id: Tab; label: string }[] = [
  { id: "plan", label: "План" },
  { id: "mcp", label: "MCP workflow" },
  { id: "session", label: "Сессия" },
  { id: "details", label: "Детали" }
];
const TASK_STATUSES: { label: string; value: TaskStatus }[] = [
  { value: "new", label: "Новая" },
  { value: "planning", label: "Планирование" },
  { value: "implementation", label: "Реализация" },
  { value: "completed", label: "Выполнено" }
];

export interface TaskDetailPanelProps {
  detail: TaskDetail | null;
  editorMode: "view" | "edit";
  isDeletingTask: boolean;
  isSavingPlan: boolean;
  isUpdatingStatus: boolean;
  onAppendNote(taskId: string, note: string): void;
  onDeleteTask(taskId: string): void;
  onSavePlan(taskId: string, contentMd: string): void;
  onSetEditorMode(mode: "view" | "edit"): void;
  onUpdateStatus(taskId: string, status: TaskStatus): void;
}

export function TaskDetailPanel(props: TaskDetailPanelProps) {
  const [note, setNote] = useState("");
  const [draftPlan, setDraftPlan] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("plan");

  useEffect(() => {
    setDraftPlan(props.detail?.plan?.contentMd ?? "");
    setNote("");
    setActiveTab("plan");
  }, [props.detail?.plan?.contentMd, props.detail?.task.id]);

  if (!props.detail) {
    return (
      <section className="app-card flex min-h-[720px] items-center justify-center text-center text-slate-500">
        Выберите задачу слева или создайте новую, чтобы открыть карточку и план.
      </section>
    );
  }

  const detail = props.detail;
  const dirty = draftPlan !== (detail.plan?.contentMd ?? "");
  const busy = props.isDeletingTask || props.isSavingPlan || props.isUpdatingStatus;

  return (
    <section className="app-card flex min-h-[720px] flex-col gap-0">
      {/* Header */}
      <header className="space-y-3 pb-5">
        {/* Breadcrumb */}
        <p className="text-xs text-slate-400">
          {detail.task.projectName} <span className="mx-1">/</span> {detail.task.title}
        </p>

        {/* Title + toolbar */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{detail.task.title}</h2>
            <div className="task-meta-row">
              <TaskStatusBadge status={detail.task.status} />
              <span>{detail.task.projectName}</span>
              <span>Создана {new Date(detail.task.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</span>
              <span className="font-mono text-slate-300">{detail.task.id.slice(0, 8)}…</span>
            </div>
          </div>

          <div className="detail-toolbar">
            <Button
              type="button"
              variant="outline"
              className="border-rose-200 text-rose-700 hover:bg-rose-50"
              disabled={busy}
              onClick={() => props.onDeleteTask(detail.task.id)}
            >
              {props.isDeletingTask ? "Удаляем..." : "Удалить"}
            </Button>
            {detail.plan ? (
              <Button
                type="button"
                variant="outline"
                disabled={props.isDeletingTask}
                onClick={() => props.onSetEditorMode(props.editorMode === "view" ? "edit" : "view")}
              >
                {props.editorMode === "view" ? "Редактировать" : "Просмотр"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="default"
                disabled={props.isDeletingTask}
                onClick={() => props.onSetEditorMode("edit")}
              >
                Создать план вручную
              </Button>
            )}
          </div>
        </div>

        {detail.task.description ? (
          <p className="max-w-3xl text-sm leading-6 text-slate-600">{detail.task.description}</p>
        ) : null}

        <div className="space-y-2">
          <p className="app-label">Статус задачи</p>
          <div className="status-switcher">
            {TASK_STATUSES.map((statusOption) => (
              <button
                key={statusOption.value}
                type="button"
                className={`status-chip ${detail.task.status === statusOption.value ? "status-chip--active" : ""}`}
                disabled={busy}
                onClick={() => props.onUpdateStatus(detail.task.id, statusOption.value)}
              >
                {statusOption.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="detail-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`detail-tab ${activeTab === tab.id ? "detail-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 pt-5">
        {/* Вкладка: План */}
        {activeTab === "plan" ? (
          <div className="space-y-3">
            {props.editorMode === "edit" ? (
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={props.isDeletingTask}
                  onClick={() => {
                    setDraftPlan(detail.plan?.contentMd ?? "");
                    props.onSetEditorMode("view");
                  }}
                >
                  Отмена
                </Button>
                <Button
                  type="button"
                  disabled={!dirty || props.isSavingPlan || props.isDeletingTask}
                  onClick={() => props.onSavePlan(detail.task.id, draftPlan)}
                >
                  {props.isSavingPlan ? "Сохраняем..." : "Сохранить"}
                </Button>
              </div>
            ) : null}

            {detail.plan || props.editorMode === "edit" ? (
              props.editorMode === "edit" ? (
                <MarkdownPlanEditor value={draftPlan} onChange={setDraftPlan} />
              ) : detail.plan ? (
                <MarkdownPlanViewer contentMd={detail.plan.contentMd} />
              ) : null
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                Плана еще нет. Сгенерируйте и сохраните его через внешний MCP-клиент, например Claude Code,
                или создайте Markdown вручную в режиме редактирования.
              </div>
            )}
          </div>
        ) : null}

        {/* Вкладка: MCP workflow */}
        {activeTab === "mcp" ? (
          <div className="space-y-3">
            <p className="app-label">Планирование через MCP</p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              <p>
                Внутренний SDK-планировщик удален. Теперь планирование делается только внешним MCP-клиентом,
                например Claude Code.
              </p>
              <p className="mt-3">
                Рекомендуемый запрос:
                <span className="block rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-700">
                  Активируй в aitasker проект "{detail.task.projectName}", найди задачу "{detail.task.title}",
                  распланируй ее и сохрани план обратно через MCP.
                </span>
              </p>
              <p className="mt-3">
                Для точного обращения можно использовать task id:
                <span className="block rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-700">
                  {detail.task.id}
                </span>
              </p>
              <p className="mt-3">
                Агент должен обновлять статус задачи через MCP:
                <span className="block rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-700">
                  new - при создании, planning - во время планирования, implementation - когда план готов,
                  completed - когда работа закончена.
                </span>
              </p>
              <p className="mt-3">
                Перед работой с задачами агент должен заполнить карточку проекта:
                <span className="mt-2 block rounded-lg bg-white px-3 py-2 text-xs text-slate-700">
                  Описание: {detail.project.description || "не заполнено"}
                  <br />
                  Путь: {detail.project.rootPath || "не заполнен"}
                  <br />
                  Языки: {detail.project.languages.length ? detail.project.languages.join(", ") : "не заполнены"}
                  <br />
                  SKILL.md: {detail.project.skillFilePath || "не указан"}
                </span>
              </p>
            </div>
          </div>
        ) : null}

        {/* Вкладка: Сессия */}
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

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="app-label">Быстрая заметка в план</p>
              <textarea
                className="app-input mt-3 min-h-28"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Добавить вопрос или заметку в план..."
              />
              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!note.trim() || props.isDeletingTask}
                  onClick={() => {
                    props.onAppendNote(detail.task.id, note);
                    setNote("");
                  }}
                >
                  Добавить заметку
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Вкладка: Детали */}
        {activeTab === "details" ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="app-label">Метаданные</p>
            <div className="mt-3 space-y-2 font-mono text-xs text-slate-600">
              <p><span className="text-slate-400">Проект:</span> {detail.task.projectName}</p>
              <p><span className="text-slate-400">Project ID:</span> {detail.task.projectId}</p>
              <p><span className="text-slate-400">Описание проекта:</span> {detail.project.description || "нет"}</p>
              <p><span className="text-slate-400">Путь проекта:</span> {detail.project.rootPath ?? "нет"}</p>
              <p>
                <span className="text-slate-400">Языки:</span>{" "}
                {detail.project.languages.length ? detail.project.languages.join(", ") : "нет"}
              </p>
              <p><span className="text-slate-400">SKILL.md:</span> {detail.project.skillFilePath ?? "нет"}</p>
              <p><span className="text-slate-400">ID:</span> {detail.task.id}</p>
              <p><span className="text-slate-400">Создана:</span> {new Date(detail.task.createdAt).toLocaleString("ru-RU")}</p>
              <p><span className="text-slate-400">Обновлена:</span> {new Date(detail.task.updatedAt).toLocaleString("ru-RU")}</p>
              <p><span className="text-slate-400">Источник плана:</span> {detail.plan?.source ?? "нет"}</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
