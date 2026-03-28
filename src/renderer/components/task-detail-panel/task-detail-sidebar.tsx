/*
Назначение: Отрисовывает правую колонку карточки задачи с метаданными, связями и быстрыми MCP-шорткатами.
Не входит: Основное содержимое вкладок, редактор плана и поиск по плану.
*/
import { useState } from "react";
import { LinkResourceDialog } from "@/renderer/components/link-resource-dialog";
import { LinkTaskDialog } from "@/renderer/components/link-task-dialog";
import { McpPromptShortcuts } from "@/renderer/components/mcp-prompt-shortcuts";
import type { TaskDetail, TaskStatus } from "@/shared/contracts/desktop-api";
import { TaskDetailLinkedResourcesSection } from "./task-detail-linked-resources-section";
import { formatRuDate, formatRuDateTime } from "./task-detail-panel-helpers";
import { TaskDetailLinkedTasksSection } from "./task-detail-linked-tasks-section";
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

        <TaskDetailLinkedTasksSection
          linkedTasks={detail.linkedTasks}
          isUnlinkingTask={isUnlinkingTask}
          onUnlinkTask={onUnlinkTask}
          onOpenLinkDialog={() => setLinkDialogOpen(true)}
        />

        <TaskDetailLinkedResourcesSection
          linkedResources={detail.linkedResources}
          isUnlinkingResource={isUnlinkingResource}
          onUnlinkResource={onUnlinkResource}
          onOpenLinkResourceDialog={() => setLinkResourceDialogOpen(true)}
        />

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
