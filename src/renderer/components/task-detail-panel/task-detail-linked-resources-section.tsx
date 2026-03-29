/*
Назначение: Отрисовывает секцию связанных ресурсов в сайдбаре карточки задачи и действия привязки/отвязки.
Не входит: Отрисовка других секций сайдбара (метаданные, задачи, MCP-шорткаты) и управление диалогом привязки.
*/
import { BookOpen, X } from "lucide-react";
import type { TaskDetail } from "@/shared/contracts/desktop-api";

export interface TaskDetailLinkedResourcesSectionProps {
  linkedResources: TaskDetail["linkedResources"];
  isUnlinkingResource: boolean;
  onUnlinkResource(linkId: string): void;
  onOpenLinkResourceDialog(): void;
}

export function TaskDetailLinkedResourcesSection({
  linkedResources,
  isUnlinkingResource,
  onUnlinkResource,
  onOpenLinkResourceDialog
}: TaskDetailLinkedResourcesSectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Ресурсы</span>

      {linkedResources.length === 0 ? (
        <p className="text-xs text-muted-foreground">Нет привязанных ресурсов</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {linkedResources.map((linked) => (
            <div
              key={linked.id}
              className="group flex items-start gap-2 rounded-xl border bg-muted/50 px-3 py-2"
            >
              <BookOpen className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-xs font-medium text-foreground/70">{linked.name}</p>
                {linked.comment && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{linked.comment}</p>}
              </div>
              <button
                type="button"
                title="Отвязать ресурс"
                disabled={isUnlinkingResource}
                onClick={() => onUnlinkResource(linked.id)}
                className="shrink-0 rounded p-0.5 text-muted-foreground/40 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 disabled:pointer-events-none"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onOpenLinkResourceDialog}
        className="flex items-center gap-1.5 self-start rounded-lg px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground/70"
      >
        <BookOpen className="size-3" />
        Привязать ресурс
      </button>
    </div>
  );
}
