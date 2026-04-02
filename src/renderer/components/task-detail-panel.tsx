/*
Назначение: Показывает выбранную задачу в Jira-like layout, включая статус, план, контракт задачи, быстрые MCP-действия и ограничения интерфейса при незакрытых вопросах.
Не входит: Отрисовка списка задач и форма создания задач.
*/
import { useEffect, useState } from "react";
import { Eye, FilePlus, Pencil, Trash2 } from "lucide-react";
import { McpPlanningPanel } from "@/renderer/components/mcp-planning-panel";
import { SearchBar } from "@/renderer/components/search-bar";
import { TaskPlanWorkspace } from "@/renderer/components/task-plan-workspace";
import { useTextSearch } from "@/renderer/features/tasks/use-text-search";
import type { TaskContextRecord, TaskDetail, TaskStatus } from "@/shared/contracts/desktop-api";
import { TaskDetailEditableSummary } from "./task-detail-panel/task-detail-editable-summary";
import { TaskContractTab } from "./task-detail-panel/task-contract-tab";
import {
  getOpenQuestionsCount,
  isTaskDetailBusy
} from "./task-detail-panel/task-detail-panel-helpers";
import { TaskOpenQuestionsAlert } from "./task-detail-panel/task-open-questions-alert";
import { TaskSessionTab } from "./task-detail-panel/task-session-tab";
import { TaskDetailSidebar } from "./task-detail-panel/task-detail-sidebar";
import { TaskStatusDropdown } from "./task-detail-panel/task-status-dropdown";

type Tab = "plan" | "contract" | "mcp" | "session";

const TABS: { id: Tab; label: string }[] = [
  { id: "plan", label: "План" },
  { id: "contract", label: "Контракт задачи" },
  { id: "mcp", label: "MCP workflow" },
  { id: "session", label: "Сессия" }
];

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
  onSaveTaskContract(taskId: string, taskContext: TaskContextRecord): void;
  onSetEditorMode(mode: "view" | "edit"): void;
  onUnlinkResource(linkId: string): void;
  onUnlinkTask(linkId: string): void;
  onUpdateStatus(taskId: string, status: TaskStatus): void;
  onUpdateTask(taskId: string, fields: { title?: string; description?: string }): void;
}

export function TaskDetailPanel(props: TaskDetailPanelProps) {
  const [draftPlan, setDraftPlan] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("plan");
  const search = useTextSearch();

  useEffect(() => {
    setDraftPlan(props.detail?.plan?.contentMd ?? "");
    setActiveTab("plan");
    search.close();
  }, [props.detail?.plan?.contentMd, props.detail?.task.id]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey && (event.key === "f" || event.code === "KeyF")) {
        if (activeTab === "plan" && props.editorMode === "view") {
          event.preventDefault();
          search.open();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [activeTab, props.editorMode, search.open]);

  useEffect(() => {
    if (activeTab !== "plan") {
      search.close();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!search.isOpen || !search.containerRef.current) {
      search.setTotalCount(0);
      return;
    }

    const count = search.containerRef.current.querySelectorAll("mark.search-highlight").length;
    search.setTotalCount(count);
  });

  if (!props.detail) {
    return (
      <section className="app-card flex min-h-[720px] items-center justify-center text-center text-muted-foreground">
        Выберите задачу слева или создайте новую, чтобы открыть карточку и план.
      </section>
    );
  }

  const detail = props.detail;
  const openQuestionsCount = getOpenQuestionsCount(detail);
  const hasOpenQuestions = openQuestionsCount > 0;
  const busy = isTaskDetailBusy({
    isDeletingTask: props.isDeletingTask,
    isSavingPlan: props.isSavingPlan,
    isUpdatingStatus: props.isUpdatingStatus,
    isRestoringRevision: props.isRestoringRevision
  });

  return (
    <section className="app-card grid min-h-[720px] grid-cols-1 lg:grid-cols-[1fr_260px]">
      <div className="flex min-w-0 flex-col pr-0 lg:pr-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {detail.task.projectName} <span className="mx-1">/</span> {detail.task.title}
          </p>
          <div className="flex items-center gap-1">
            {detail.plan ? (
              <button
                type="button"
                title={props.editorMode === "view" ? "Редактировать план" : "Просмотр"}
                disabled={props.isDeletingTask}
                onClick={() => props.onSetEditorMode(props.editorMode === "view" ? "edit" : "view")}
                className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground/70 disabled:pointer-events-none disabled:opacity-40"
              >
                {props.editorMode === "view" ? <Pencil className="size-4" /> : <Eye className="size-4" />}
              </button>
            ) : (
              <button
                type="button"
                title="Создать план вручную"
                disabled={props.isDeletingTask}
                onClick={() => props.onSetEditorMode("edit")}
                className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground/70 disabled:pointer-events-none disabled:opacity-40"
              >
                <FilePlus className="size-4" />
              </button>
            )}
            <button
              type="button"
              title="Удалить задачу"
              disabled={busy}
              onClick={() => props.onDeleteTask(detail.task.id)}
              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-rose-50 hover:text-rose-600 disabled:pointer-events-none disabled:opacity-40"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>

        <div className="mb-3 flex items-center gap-3">
          <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
            TASK-{detail.task.id.slice(0, 8).toUpperCase()}
          </span>
          <div className="w-48">
            <TaskStatusDropdown
              status={detail.task.status}
              disabled={busy}
              hasOpenQuestions={hasOpenQuestions}
              onUpdate={(status) => props.onUpdateStatus(detail.task.id, status)}
            />
          </div>
        </div>

        {hasOpenQuestions ? <TaskOpenQuestionsAlert openQuestionsCount={openQuestionsCount} /> : null}

        <TaskDetailEditableSummary
          detail={detail}
          isUpdatingTask={props.isUpdatingTask}
          onUpdateTask={props.onUpdateTask}
        />

        <div className="mb-5 flex gap-0 border-b">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground/70"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1">
          {activeTab === "plan" ? (
            <div ref={search.containerRef as React.RefObject<HTMLDivElement>}>
              {search.isOpen && props.editorMode === "view" && (
                <div className="sticky top-0 z-30 flex justify-end pb-2">
                  <SearchBar
                    query={search.query}
                    currentIndex={search.currentIndex}
                    totalCount={search.totalCount}
                    onQueryChange={search.setQuery}
                    onNext={search.next}
                    onPrev={search.prev}
                    onClose={search.close}
                  />
                </div>
              )}
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
                searchQuery={search.isOpen && props.editorMode === "view" ? search.query : undefined}
                onAppendPlanExtension={props.onAppendPlanExtension}
                onAppendPlanImprovement={props.onAppendPlanImprovement}
                onChangeDraftPlan={setDraftPlan}
                onRestoreRevision={(revisionId) => props.onRestorePlanRevision(detail.task.id, revisionId)}
                onSavePlan={props.onSavePlan}
                onSetEditorMode={props.onSetEditorMode}
              />
            </div>
          ) : null}

          {activeTab === "mcp" ? <McpPlanningPanel detail={detail} /> : null}

          {activeTab === "contract" ? (
            <TaskContractTab
              detail={detail}
              isDeletingTask={props.isDeletingTask}
              isRestoringRevision={props.isRestoringRevision}
              isSavingPlan={props.isSavingPlan}
              onSaveTaskContract={props.onSaveTaskContract}
            />
          ) : null}

          {activeTab === "session" ? <TaskSessionTab detail={detail} /> : null}
        </div>
      </div>

      <TaskDetailSidebar
        detail={detail}
        busy={busy}
        hasOpenQuestions={hasOpenQuestions}
        isLinkingResource={props.isLinkingResource}
        isLinkingTask={props.isLinkingTask}
        isUnlinkingResource={props.isUnlinkingResource}
        isUnlinkingTask={props.isUnlinkingTask}
        onLinkResource={props.onLinkResource}
        onLinkTask={props.onLinkTask}
        onUnlinkResource={props.onUnlinkResource}
        onUnlinkTask={props.onUnlinkTask}
        onUpdateStatus={props.onUpdateStatus}
      />
    </section>
  );
}
