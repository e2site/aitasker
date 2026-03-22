/*
Назначение: Отрисовывает правую колонку карточки задачи с метаданными, связями и быстрыми MCP-шорткатами.
Не входит: Основное содержимое вкладок, редактор плана и поиск по плану.
*/
import { useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Link, X } from "lucide-react";
import { LinkResourceDialog } from "@/renderer/components/link-resource-dialog";
import { LinkTaskDialog } from "@/renderer/components/link-task-dialog";
import { McpPromptShortcuts } from "@/renderer/components/mcp-prompt-shortcuts";
import type { TaskDetail, TaskStatus } from "@/shared/contracts/desktop-api";
import { formatRuDate, formatRuDateTime } from "./task-detail-panel-helpers";
import { TaskDetailMetaField } from "./task-detail-meta-field";
import { TaskStatusDropdown } from "./task-status-dropdown";

export interface TaskDetailSidebarProps {
  detail: TaskDetail;
  busy: boolean;
  hasOpenQuestions: boolean;
  isLinkingResource: boolean;
  isLinkingTask: boolean;
  isUnlinkingResource: boolean;
  isUnlinkingTask: boolean;
  onLinkResource(resourceId: string, comment: string): void;
  onLinkTask(targetTaskId: string, comment: string): void;
  onUnlinkResource(linkId: string): void;
  onUnlinkTask(linkId: string): void;
  onUpdateStatus(taskId: string, status: TaskStatus): void;
}

export function TaskDetailSidebar({
  detail,
  busy,
  hasOpenQuestions,
  isLinkingResource,
  isLinkingTask,
  isUnlinkingResource,
  isUnlinkingTask,
  onLinkResource,
  onLinkTask,
  onUnlinkResource,
  onUnlinkTask,
  onUpdateStatus
}: TaskDetailSidebarProps) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkResourceDialogOpen, setLinkResourceDialogOpen] = useState(false);

  return (
    <>
      <aside className="mt-6 flex flex-col gap-4 border-t border-slate-100 pt-6 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        <TaskDetailMetaField label="Проект" value={detail.task.projectName} />

        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Статус</span>
          <TaskStatusDropdown
            status={detail.task.status}
            disabled={busy}
            hasOpenQuestions={hasOpenQuestions}
            onUpdate={(status) => onUpdateStatus(detail.task.id, status)}
          />
        </div>

        <TaskDetailMetaField label="Создана" value={formatRuDate(detail.task.createdAt)} />
        <TaskDetailMetaField label="Обновлена" value={formatRuDateTime(detail.task.updatedAt)} />
        <TaskDetailMetaField label="ID" value={<span className="font-mono text-xs">{detail.task.id}</span>} />
        <TaskDetailMetaField label="Путь" value={detail.project.rootPath} />
        <TaskDetailMetaField
          label="Языки"
          value={detail.project.languages.length ? detail.project.languages.join(", ") : null}
        />
        <TaskDetailMetaField label="SKILL.md" value={detail.project.skillFilePath} />

        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Связанные задачи</span>

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
                    <p className="line-clamp-2 text-xs font-medium text-slate-700">{linked.title}</p>
                    {linked.comment && <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{linked.comment}</p>}
                  </div>
                  <button
                    type="button"
                    title="Отвязать задачу"
                    disabled={isUnlinkingTask}
                    onClick={() => onUnlinkTask(linked.id)}
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

        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Ресурсы</span>

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
                    <p className="line-clamp-2 text-xs font-medium text-slate-700">{linked.name}</p>
                    {linked.comment && <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{linked.comment}</p>}
                  </div>
                  <button
                    type="button"
                    title="Отвязать ресурс"
                    disabled={isUnlinkingResource}
                    onClick={() => onUnlinkResource(linked.id)}
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

        <McpPromptShortcuts detail={detail} />
      </aside>

      <LinkTaskDialog
        currentTaskId={detail.task.id}
        existingLinkedTaskIds={detail.linkedTasks.map((linked) => linked.taskId)}
        isLinking={isLinkingTask}
        isOpen={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        onLink={(targetTaskId, comment) => {
          onLinkTask(targetTaskId, comment);
          setLinkDialogOpen(false);
        }}
      />

      <LinkResourceDialog
        existingLinkedResourceIds={detail.linkedResources.map((linked) => linked.resourceId)}
        isLinking={isLinkingResource}
        isOpen={linkResourceDialogOpen}
        onClose={() => setLinkResourceDialogOpen(false)}
        onLink={(resourceId, comment) => {
          onLinkResource(resourceId, comment);
          setLinkResourceDialogOpen(false);
        }}
      />
    </>
  );
}
