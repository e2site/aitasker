/*
Назначение: Панель просмотра и редактирования ресурса — название и Markdown-содержимое с автосохранением при blur/смене ресурса.
Не входит: Список ресурсов, привязка к задачам и навигация.
*/
import { useEffect, useState } from "react";
import { Check, Copy, Eye, Pencil, Trash2 } from "lucide-react";
import { MarkdownPlanEditor } from "@/renderer/editors/markdown-plan-editor";
import { MarkdownPlanViewer } from "@/renderer/components/markdown-plan-viewer";
import type { ResourceRecord } from "@/shared/contracts/desktop-api";

export interface ResourceDetailPanelProps {
  resource: ResourceRecord;
  isDeleting: boolean;
  isSaving: boolean;
  onDelete(id: string): void;
  onSave(id: string, fields: { name?: string; contentMd?: string }): void;
}

export function ResourceDetailPanel({
  resource,
  isDeleting,
  isSaving,
  onDelete,
  onSave
}: ResourceDetailPanelProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(resource.name);
  const [contentDraft, setContentDraft] = useState(resource.contentMd);
  const [editorMode, setEditorMode] = useState<"view" | "edit">("view");
  const [copied, setCopied] = useState(false);

  // Сбрасываем черновики при смене ресурса
  useEffect(() => {
    setNameDraft(resource.name);
    setContentDraft(resource.contentMd);
    setEditingName(false);
    setEditorMode("view");
  }, [resource.id, resource.name, resource.contentMd]);

  const busy = isDeleting || isSaving;

  const saveNameIfChanged = () => {
    const trimmed = nameDraft.trim();
    if (trimmed.length >= 1 && trimmed !== resource.name) {
      onSave(resource.id, { name: trimmed });
    }
    setEditingName(false);
  };

  const copyPrompt = async () => {
    const text = `Для получения ресурсов "${resource.name}" выполни get_resource с id "${resource.id}"`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const saveContent = () => {
    if (contentDraft !== resource.contentMd) {
      onSave(resource.id, { contentMd: contentDraft });
    }
    setEditorMode("view");
  };

  return (
    <section className="app-card min-h-[720px] flex flex-col">
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400 font-mono">RES-{resource.id.slice(0, 8).toUpperCase()}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Скопировать промт"
            onClick={copyPrompt}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
          </button>
          <button
            type="button"
            title={editorMode === "view" ? "Редактировать" : "Просмотр"}
            disabled={busy}
            onClick={() => {
              if (editorMode === "edit") {
                saveContent();
              } else {
                setEditorMode("edit");
              }
            }}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-40"
          >
            {editorMode === "view" ? <Pencil className="size-4" /> : <Eye className="size-4" />}
          </button>
          <button
            type="button"
            title="Удалить ресурс"
            disabled={busy}
            onClick={() => {
              const confirmed = window.confirm(`Удалить ресурс "${resource.name}"?`);
              if (confirmed) onDelete(resource.id);
            }}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:pointer-events-none disabled:opacity-40"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {/* Название */}
      {editingName ? (
        <input
          autoFocus
          className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-2xl font-semibold tracking-tight text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          value={nameDraft}
          disabled={busy}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={saveNameIfChanged}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.currentTarget.blur(); }
            if (e.key === "Escape") { setNameDraft(resource.name); setEditingName(false); }
          }}
        />
      ) : (
        <h1
          className="group mb-4 cursor-text rounded-lg px-2 py-1 text-2xl font-semibold tracking-tight text-slate-950 hover:bg-slate-50"
          onClick={() => { setNameDraft(resource.name); setEditingName(true); }}
          title="Нажмите, чтобы редактировать"
        >
          {resource.name}
          <Pencil className="ml-2 inline size-3.5 text-slate-300 opacity-0 transition group-hover:opacity-100" />
        </h1>
      )}

      {/* Содержимое */}
      <div className="flex-1">
        {editorMode === "edit" ? (
          <div className="flex flex-col gap-3">
            <MarkdownPlanEditor
              value={contentDraft}
              onChange={setContentDraft}
              resetKey={resource.id}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setContentDraft(resource.contentMd); setEditorMode("view"); }}
                className="rounded-lg px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={saveContent}
                disabled={isSaving}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
              >
                {isSaving ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </div>
        ) : resource.contentMd ? (
          <MarkdownPlanViewer contentMd={resource.contentMd} />
        ) : (
          <p
            className="cursor-pointer rounded-lg p-3 text-sm text-slate-400 hover:bg-slate-50"
            onClick={() => setEditorMode("edit")}
          >
            Нет содержимого. Нажмите, чтобы добавить...
          </p>
        )}
      </div>

      {/* Метаданные */}
      <div className="mt-4 flex gap-4 border-t border-slate-100 pt-4 text-xs text-slate-400">
        <span>Создан: {new Date(resource.createdAt).toLocaleDateString("ru-RU")}</span>
        <span>Обновлён: {new Date(resource.updatedAt).toLocaleString("ru-RU")}</span>
      </div>
    </section>
  );
}
