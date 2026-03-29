/*
Назначение: Страница глобальных ресурсов — список всех ресурсов слева и детальная карточка справа.
Не входит: Привязка к задачам, навигация между страницами и работа с планами задач.
*/
import { useState } from "react";
import { BookOpen, Plus } from "lucide-react";
import { AppShell } from "@/renderer/components/app-shell";
import { ResourceDetailPanel } from "@/renderer/components/resource-detail-panel";
import { useResourcesQuery } from "@/renderer/features/resources/use-resource-queries";
import {
  useCreateResourceMutation,
  useDeleteResourceMutation,
  useUpdateResourceMutation
} from "@/renderer/features/resources/use-resource-mutations";

export function ResourcesPage() {
  const resourcesQuery = useResourcesQuery();
  const createMutation = useCreateResourceMutation();
  const updateMutation = useUpdateResourceMutation();
  const deleteMutation = useDeleteResourceMutation();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const resources = resourcesQuery.data ?? [];

  const filteredResources = resources.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return r.name.toLowerCase().includes(q) || r.contentMd.toLowerCase().includes(q);
  });

  const selectedResource = resources.find((r) => r.id === selectedId) ?? null;

  const handleCreate = () => {
    createMutation.mutate(
      { name: "Новый ресурс", contentMd: "" },
      {
        onSuccess(resource) {
          setSelectedId(resource.id);
        }
      }
    );
  };

  return (
    <AppShell>
      <div className="flex min-h-0 flex-1 gap-4" style={{ gridColumn: "1 / -1" }}>
        {/* Левая панель: список */}
        <div className="flex w-72 shrink-0 flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground/70">
              <BookOpen className="size-4" />
              Ресурсы
            </h2>
            <button
              type="button"
              title="Создать ресурс"
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground/70 disabled:opacity-50"
            >
              <Plus className="size-3.5" />
              Создать
            </button>
          </div>

          <input
            type="text"
            placeholder="Поиск ресурсов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-lg border px-3 py-1.5 text-sm text-foreground bg-background outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring/30"
          />

          <div className="flex flex-col gap-1 overflow-y-auto">
            {filteredResources.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {resources.length === 0 ? "Нет ресурсов. Создайте первый." : "Ничего не найдено"}
              </p>
            ) : (
              filteredResources.map((resource) => (
                <button
                  key={resource.id}
                  type="button"
                  onClick={() => setSelectedId(resource.id)}
                  className={`flex flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left transition ${
                    resource.id === selectedId
                      ? "bg-muted text-foreground"
                      : "hover:bg-muted/50 text-foreground/70"
                  }`}
                >
                  <span className="text-sm font-medium line-clamp-1">{resource.name}</span>
                  {resource.contentMd && (
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {resource.contentMd.slice(0, 60)}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Правая панель: детали */}
        <div className="flex-1 min-w-0">
          {selectedResource ? (
            <ResourceDetailPanel
              resource={selectedResource}
              isDeleting={deleteMutation.isPending}
              isSaving={updateMutation.isPending}
              onDelete={(id) => {
                deleteMutation.mutate(id, {
                  onSuccess() {
                    setSelectedId(null);
                  }
                });
              }}
              onSave={(id, fields) => {
                updateMutation.mutate({ id, ...fields });
              }}
            />
          ) : (
            <section className="app-card flex min-h-[720px] items-center justify-center text-center text-muted-foreground">
              <div className="flex flex-col items-center gap-3">
                <BookOpen className="size-10 text-muted-foreground/30" />
                <p className="text-sm">Выберите ресурс из списка или создайте новый</p>
              </div>
            </section>
          )}
        </div>
      </div>
    </AppShell>
  );
}
