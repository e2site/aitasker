/*
Назначение: Отвечает за редактируемый блок заголовка и описания задачи в карточке.
Не входит: Табы, блок плана, операции со статусом и правая колонка метаданных.
*/
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { MarkdownPlanEditor } from "@/renderer/editors/markdown-plan-editor";
import { MarkdownPlanViewer } from "@/renderer/components/markdown-plan-viewer";
import type { TaskDetail } from "@/shared/contracts/desktop-api";

export interface TaskDetailEditableSummaryProps {
  detail: TaskDetail;
  isUpdatingTask: boolean;
  onUpdateTask(taskId: string, fields: { title?: string; description?: string }): void;
}

export function TaskDetailEditableSummary({
  detail,
  isUpdatingTask,
  onUpdateTask
}: TaskDetailEditableSummaryProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [hasDescriptionOverflow, setHasDescriptionOverflow] = useState(false);
  const descriptionContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setEditingTitle(false);
    setEditingDescription(false);
    setDescriptionExpanded(false);
    setHasDescriptionOverflow(false);
    setTitleDraft(detail.task.title);
    setDescriptionDraft(detail.task.description);
  }, [detail.task.id, detail.task.title, detail.task.description]);

  useEffect(() => {
    if (descriptionExpanded || !detail.task.description) {
      return;
    }

    const element = descriptionContainerRef.current;

    if (!element) {
      setHasDescriptionOverflow(false);
      return;
    }

    const updateOverflowState = () => {
      setHasDescriptionOverflow(element.scrollHeight - element.clientHeight > 1);
    };

    updateOverflowState();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => updateOverflowState());
      observer.observe(element);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateOverflowState);
    return () => window.removeEventListener("resize", updateOverflowState);
  }, [descriptionExpanded, detail.task.description]);

  return (
    <>
      {editingTitle ? (
        <input
          autoFocus
          className="mb-2 w-full rounded-lg border bg-background px-2 py-1 text-2xl font-semibold tracking-tight text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          value={titleDraft}
          disabled={isUpdatingTask}
          onChange={(event) => setTitleDraft(event.target.value)}
          onBlur={() => {
            const trimmed = titleDraft.trim();
            if (trimmed.length >= 3 && trimmed !== detail.task.title) {
              onUpdateTask(detail.task.id, { title: trimmed });
            }
            setEditingTitle(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              setEditingTitle(false);
            }
          }}
        />
      ) : (
        <h1
          className="group mb-2 cursor-text rounded-lg px-2 py-1 text-2xl font-semibold tracking-tight text-foreground hover:bg-muted/50"
          onClick={() => {
            setTitleDraft(detail.task.title);
            setEditingTitle(true);
          }}
          title="Нажмите, чтобы редактировать"
        >
          {detail.task.title}
          <Pencil className="ml-2 inline size-3.5 text-muted-foreground/40 opacity-0 transition group-hover:opacity-100" />
        </h1>
      )}

      {editingDescription ? (
        <div className="mb-5">
          <MarkdownPlanEditor value={descriptionDraft} onChange={setDescriptionDraft} resetKey={detail.task.id} />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingDescription(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-foreground/70 transition hover:bg-muted"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={isUpdatingTask}
              onClick={() => {
                const trimmed = descriptionDraft.trim();
                if (trimmed.length >= 12 && trimmed !== detail.task.description) {
                  onUpdateTask(detail.task.id, { description: trimmed });
                }
                setEditingDescription(false);
              }}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {isUpdatingTask ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-5">
          {detail.task.description ? (
            <>
              <div
                className="relative"
                onClick={
                  detail.task.status === "new"
                    ? () => {
                        setDescriptionDraft(detail.task.description);
                        setEditingDescription(true);
                      }
                    : undefined
                }
                style={detail.task.status === "new" ? { cursor: "text" } : undefined}
                title={detail.task.status === "new" ? "Нажмите, чтобы редактировать" : undefined}
              >
                <div
                  ref={descriptionContainerRef}
                  style={descriptionExpanded ? undefined : { maxHeight: "8rem", overflow: "hidden" }}
                >
                  <MarkdownPlanViewer contentMd={detail.task.description} />
                </div>
                {!descriptionExpanded && hasDescriptionOverflow && (
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-background to-transparent" />
                )}
              </div>
              <div className="mt-1 flex items-center gap-3">
                {hasDescriptionOverflow && (
                  <button
                    type="button"
                    onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                    className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground/70"
                  >
                    {descriptionExpanded ? (
                      <>
                        <ChevronUp className="size-3" /> Свернуть
                      </>
                    ) : (
                      <>
                        <ChevronDown className="size-3" /> Развернуть
                      </>
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
                    className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground/70"
                  >
                    <Pencil className="size-3" /> Редактировать
                  </button>
                )}
              </div>
            </>
          ) : detail.task.status === "new" ? (
            <p
              className="cursor-text rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-muted/50"
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
    </>
  );
}
