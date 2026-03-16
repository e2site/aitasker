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
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <BookOpen className="size-4" />
              Ресурсы
            </h2>
            <button
              type="button"
              title="Создать ресурс"
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
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
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
          />

          <div className="flex flex-col gap-1 overflow-y-auto">
            {filteredResources.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
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
                      ? "bg-slate-100 text-slate-900"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <span className="text-sm font-medium line-clamp-1">{resource.name}</span>
                  {resource.contentMd && (
                    <span className="text-xs text-slate-400 line-clamp-1">
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
            <section className="app-card flex min-h-[720px] items-center justify-center text-center text-slate-500">
              <div className="flex flex-col items-center gap-3">
                <BookOpen className="size-10 text-slate-200" />
                <p className="text-sm">Выберите ресурс из списка или создайте новый</p>
              </div>
            </section>
          )}
        </div>
      </div>
    </AppShell>
  );
}
