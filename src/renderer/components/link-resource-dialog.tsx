/*
Назначение: Двухшаговый модальный диалог для привязки ресурса к задаче — шаг 1: поиск из списка, шаг 2: добавление комментария и подтверждение.
Не входит: Логика хранения связей, маршрутизация и управление глобальным состоянием.
*/
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Search, X } from "lucide-react";
import type { ResourceRecord } from "@/shared/contracts/desktop-api";
import { useResourcesQuery } from "@/renderer/features/resources/use-resource-queries";

export interface LinkResourceDialogProps {
  existingLinkedResourceIds: string[];
  isLinking: boolean;
  isOpen: boolean;
  onClose(): void;
  onLink(resourceId: string, comment: string): void;
}

export function LinkResourceDialog({
  existingLinkedResourceIds,
  isLinking,
  isOpen,
  onClose,
  onLink
}: LinkResourceDialogProps) {
  const resourcesQuery = useResourcesQuery();
  const [step, setStep] = useState<"search" | "confirm">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResource, setSelectedResource] = useState<ResourceRecord | null>(null);
  const [comment, setComment] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStep("search");
      setSearchQuery("");
      setSelectedResource(null);
      setComment("");
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const allResources = resourcesQuery.data ?? [];
  const excludedIds = new Set(existingLinkedResourceIds);

  const filteredResources = allResources.filter((r) => {
    if (excludedIds.has(r.id)) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return r.name.toLowerCase().includes(q) || r.contentMd.toLowerCase().includes(q);
  });

  const handleSelectResource = (resource: ResourceRecord) => {
    setSelectedResource(resource);
    setStep("confirm");
  };

  const handleLink = () => {
    if (!selectedResource || isLinking) return;
    onLink(selectedResource.id, comment.trim());
  };

  const handleBackToSearch = () => {
    setStep("search");
    setSelectedResource(null);
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
            <BookOpen className="size-4 text-muted-foreground" />
            <span className="font-medium text-sm">
              {step === "search" ? "Привязать ресурс" : "Подтверждение привязки"}
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
                placeholder="Поиск по названию или содержимому..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm text-foreground bg-background outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring/30"
              />
            </div>

            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {filteredResources.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {searchQuery ? "Ничего не найдено" : allResources.length === 0 ? "Нет созданных ресурсов" : "Нет доступных ресурсов для привязки"}
                </p>
              ) : (
                filteredResources.map((resource) => (
                  <button
                    key={resource.id}
                    type="button"
                    onClick={() => handleSelectResource(resource)}
                    className="flex flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-muted/50"
                  >
                    <span className="text-sm font-medium text-foreground line-clamp-1">{resource.name}</span>
                    {resource.contentMd && (
                      <span className="text-xs text-muted-foreground line-clamp-1">{resource.contentMd.slice(0, 80)}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Step 2: Confirm */}
        {step === "confirm" && selectedResource && (
          <div className="flex flex-col gap-4 p-5">
            <div className="rounded-xl border bg-muted/50 px-4 py-3">
              <p className="text-sm font-medium text-foreground">{selectedResource.name}</p>
              {selectedResource.contentMd && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{selectedResource.contentMd.slice(0, 120)}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground/70">
                Комментарий <span className="font-normal text-muted-foreground">(необязательно)</span>
              </label>
              <textarea
                rows={3}
                placeholder="Например: используется как шаблон развёртывания..."
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
