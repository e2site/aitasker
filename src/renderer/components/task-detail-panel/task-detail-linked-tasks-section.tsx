/*
Назначение: Отрисовывает секцию связанных задач в сайдбаре карточки задачи и действия привязки/отвязки.
Не входит: Отрисовка других секций сайдбара (метаданные, ресурсы, MCP-шорткаты) и управление диалогом привязки.
*/
import { ArrowLeft, ArrowRight, Link, X } from "lucide-react";
import type { TaskDetail } from "@/shared/contracts/desktop-api";

export interface TaskDetailLinkedTasksSectionProps {
  linkedTasks: TaskDetail["linkedTasks"];
  isUnlinkingTask: boolean;
  onUnlinkTask(linkId: string): void;
  onOpenLinkDialog(): void;
}

export function TaskDetailLinkedTasksSection({
  linkedTasks,
  isUnlinkingTask,
  onUnlinkTask,
  onOpenLinkDialog
}: TaskDetailLinkedTasksSectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Связанные задачи</span>

      {linkedTasks.length === 0 ? (
        <p className="text-xs text-slate-400">Нет привязанных задач</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {linkedTasks.map((linked) => (
            <div
              key={linked.id}
              className="group flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
            >
              <span className="mt-0.5 shrink-0 text-slate-400">
                {linked.direction === "outgoing" ? <ArrowRight className="size-3" /> : <ArrowLeft className="size-3" />}
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
        onClick={onOpenLinkDialog}
        className="flex items-center gap-1.5 self-start rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
      >
        <Link className="size-3" />
        Привязать задачу
      </button>
    </div>
  );
}
