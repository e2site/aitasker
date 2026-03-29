/*
Назначение: Двухшаговый модальный диалог для привязки связанной задачи — шаг 1: поиск из списка, шаг 2: добавление комментария и подтверждение.
Не входит: Логика хранения связей, маршрутизация и управление глобальным состоянием.
*/
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, Search, X } from "lucide-react";
import type { LinkedTaskRecord, TaskRecord } from "@/shared/contracts/desktop-api";
import { useTasksQuery } from "@/renderer/features/tasks/use-task-queries";
import { cn } from "@/renderer/components/ui/class-names";

const STATUS_LABELS: Record<string, string> = {
  new: "Новая",
  planning: "Планирование",
  requires_clarification: "Уточнение",
  implementation: "Реализация",
  completed: "Завершена"
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-muted text-foreground/70",
  planning: "bg-sky-100 text-sky-700",
  requires_clarification: "bg-red-100 text-red-700",
  implementation: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700"
};

export interface LinkTaskDialogProps {
  currentTaskId: string;
  existingLinkedTaskIds: string[];
  isLinking: boolean;
  isOpen: boolean;
  onClose(): void;
  onLink(targetTaskId: string, comment: string): void;
}

export function LinkTaskDialog({
  currentTaskId,
  existingLinkedTaskIds,
  isLinking,
  isOpen,
  onClose,
  onLink
}: LinkTaskDialogProps) {
  const tasksQuery = useTasksQuery();
  const [step, setStep] = useState<"search" | "confirm">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  const [comment, setComment] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Сбрасываем состояние при открытии
  useEffect(() => {
    if (isOpen) {
      setStep("search");
      setSearchQuery("");
      setSelectedTask(null);
      setComment("");
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Закрытие по Escape
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const allTasks = tasksQuery.data ?? [];
  const excludedIds = new Set([currentTaskId, ...existingLinkedTaskIds]);

  const filteredTasks = allTasks.filter((task) => {
    if (excludedIds.has(task.id)) return false;
    if (!searchQuery.trim()) return true;

    const q = searchQuery.trim().toLowerCase();
    return (
      task.title.toLowerCase().includes(q) ||
      task.description.toLowerCase().includes(q) ||
      task.projectName.toLowerCase().includes(q)
    );
  });

  const handleSelectTask = (task: TaskRecord) => {
    setSelectedTask(task);
    setStep("confirm");
  };

  const handleLink = () => {
    if (!selectedTask || isLinking) return;
    onLink(selectedTask.id, comment.trim());
  };

  const handleBackToSearch = () => {
    setStep("search");
    setSelectedTask(null);
    setComment("");
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl border bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2 text-foreground">
            <Link className="size-4 text-muted-foreground" />
            <span className="font-medium text-sm">
              {step === "search" ? "Привязать задачу" : "Подтверждение связи"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground/70"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Step 1: Search */}
        {step === "search" && (
          <div className="flex flex-col gap-3 p-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Поиск по названию, описанию или проекту..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm text-foreground bg-background outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring/30"
              />
            </div>

            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {filteredTasks.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {searchQuery ? "Ничего не найдено" : "Нет доступных задач для привязки"}
                </p>
              ) : (
                filteredTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => handleSelectTask(task)}
                    className="flex flex-col gap-1 rounded-xl px-3 py-2.5 text-left transition hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                          STATUS_COLORS[task.status] ?? "bg-muted text-foreground/70"
                        )}
                      >
                        {STATUS_LABELS[task.status] ?? task.status}
                      </span>
                      <span className="text-xs text-muted-foreground">{task.projectName}</span>
                    </div>
                    <span className="text-sm font-medium text-foreground line-clamp-1">{task.title}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Step 2: Confirm */}
        {step === "confirm" && selectedTask && (
          <div className="flex flex-col gap-4 p-5">
            <div className="rounded-xl border bg-muted/50 px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    STATUS_COLORS[selectedTask.status] ?? "bg-muted text-foreground/70"
                  )}
                >
                  {STATUS_LABELS[selectedTask.status] ?? selectedTask.status}
                </span>
                <span className="text-xs text-muted-foreground">{selectedTask.projectName}</span>
              </div>
              <p className="text-sm font-medium text-foreground">{selectedTask.title}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground/70">
                Комментарий к связи <span className="font-normal text-muted-foreground">(необязательно)</span>
              </label>
              <textarea
                rows={3}
                placeholder="Например: эта задача блокирует данную..."
                value={comment}
                maxLength={500}
                onChange={(e) => setComment(e.target.value)}
                className="w-full resize-none rounded-lg border px-3 py-2 text-sm text-foreground bg-background outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring/30"
              />
              <span className="self-end text-xs text-muted-foreground">{comment.length}/500</span>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleBackToSearch}
                className="rounded-lg px-4 py-2 text-sm text-foreground/70 transition hover:bg-muted"
              >
                Назад
              </button>
              <button
                type="button"
                onClick={handleLink}
                disabled={isLinking}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
              >
                {isLinking ? "Привязка..." : "Привязать"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
