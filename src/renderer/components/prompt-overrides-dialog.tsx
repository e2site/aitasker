/*
Назначение: Модальный диалог для просмотра и переопределения MCP-промтов с предпросмотром и guard несохранённых изменений.
Не входит: Хранение промтов, логика маршрутизации и управление глобальным состоянием.
*/
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, RotateCcw, Save, Settings2, X } from "lucide-react";
import {
  BASE_PROMPT_TEMPLATES,
  getPromptVars,
  type PromptId
} from "@/renderer/components/mcp-prompt-presets";

const TASK_STATUSES = [
  { value: "new", label: "Новая", color: "bg-slate-200 text-slate-700" },
  { value: "planning", label: "Планирование", color: "bg-sky-100 text-sky-700" },
  { value: "requires_clarification", label: "Уточнение", color: "bg-red-100 text-red-700" },
  { value: "implementation", label: "Реализация", color: "bg-amber-100 text-amber-700" },
  { value: "completed", label: "Завершена", color: "bg-emerald-100 text-emerald-700" },
] as const;

import { previewPromptTemplate, renderPromptTemplate } from "@/shared/prompts/prompt-template";
import type { PromptOverrideRecord, TaskDetail } from "@/shared/contracts/desktop-api";
import {
  useDeletePromptOverrideMutation,
  usePromptOverridesQuery,
  useUpsertPromptOverrideMutation
} from "@/renderer/features/prompts/use-prompt-override-queries";
import { cn } from "@/renderer/components/ui/class-names";
import { Button } from "@/renderer/components/ui/button";

const PROMPT_LABELS: Record<PromptId, string> = {
  "activate-project": "Активация проекта",
  "agent-task-prompt": "Создать задачу в агенте",
  "plan-task": "Планирование задачи",
  "clarify-plan": "Уточнение плана",
  "implementation": "Переход к реализации",
  "finish-task": "Завершение задачи",
  "consolidate-discussion": "Сжать переписку в план",
  "project-skill": "Создание SKILL.md"
};

const PROMPT_IDS = Object.keys(BASE_PROMPT_TEMPLATES) as PromptId[];

/** Универсальный хук защиты несохранённых изменений. */
function useUnsavedChangesGuard(hasChanges: boolean) {
  function confirmClose(): boolean {
    if (!hasChanges) return true;
    return window.confirm("Есть несохранённые изменения. Закрыть без сохранения?");
  }

  return { confirmClose };
}

export interface PromptOverridesDialogProps {
  detail: TaskDetail | null;
  isOpen: boolean;
  onClose(): void;
}

interface EditorState {
  [promptId: string]: string;
}

export function PromptOverridesDialog({ detail, isOpen, onClose }: PromptOverridesDialogProps) {
  const overridesQuery = usePromptOverridesQuery();
  const upsertMutation = useUpsertPromptOverrideMutation();
  const deleteMutation = useDeletePromptOverrideMutation();

  const [selectedId, setSelectedId] = useState<PromptId>(PROMPT_IDS[0]);
  const [editorValues, setEditorValues] = useState<EditorState>({});
  const [showPreview, setShowPreview] = useState(false);
  const [copiedStatus, setCopiedStatus] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleCopyStatus(value: string) {
    if (!navigator.clipboard?.writeText) return;
    void navigator.clipboard.writeText(value).then(() => {
      setCopiedStatus(value);
      window.setTimeout(() => setCopiedStatus((cur) => cur === value ? null : cur), 1500);
    });
  }

  const overrides: PromptOverrideRecord[] = overridesQuery.data ?? [];

  // Сохранённые шаблоны из БД для каждого промта
  function getSavedTemplate(id: PromptId): string | null {
    return overrides.find((o) => o.id === id)?.template ?? null;
  }

  // Текущее значение в редакторе (или null если не изменено)
  function getEditorValue(id: PromptId): string {
    if (id in editorValues) return editorValues[id];
    return getSavedTemplate(id) ?? BASE_PROMPT_TEMPLATES[id];
  }

  function hasUnsavedChanges(): boolean {
    return PROMPT_IDS.some((id) => {
      if (!(id in editorValues)) return false;
      const saved = getSavedTemplate(id) ?? BASE_PROMPT_TEMPLATES[id];
      return editorValues[id] !== saved;
    });
  }

  const { confirmClose } = useUnsavedChangesGuard(hasUnsavedChanges());

  // Сброс состояния при открытии
  useEffect(() => {
    if (isOpen) {
      setSelectedId(PROMPT_IDS[0]);
      setEditorValues({});
      setShowPreview(false);
    }
  }, [isOpen]);

  // Фокус на textarea при смене промта
  useEffect(() => {
    if (isOpen && !showPreview) {
      textareaRef.current?.focus();
    }
  }, [isOpen, selectedId, showPreview]);

  // Закрытие по Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editorValues, overrides]);

  if (!isOpen) return null;

  const vars = detail ? getPromptVars(detail) : [];
  const currentValue = getEditorValue(selectedId);
  const savedTemplate = getSavedTemplate(selectedId);
  const isOverridden = savedTemplate !== null;
  const isEdited = selectedId in editorValues && editorValues[selectedId] !== (savedTemplate ?? BASE_PROMPT_TEMPLATES[selectedId]);

  const previewText = showPreview
    ? (vars.length > 0
        ? previewPromptTemplate(currentValue, vars)
        : renderPromptTemplate(currentValue, []))
    : currentValue;

  function handleClose() {
    if (confirmClose()) onClose();
  }

  function handleSave() {
    upsertMutation.mutate({ id: selectedId, template: currentValue }, {
      onSuccess() {
        setEditorValues((prev) => {
          const next = { ...prev };
          delete next[selectedId];
          return next;
        });
      }
    });
  }

  function handleReset() {
    if (isOverridden) {
      if (!window.confirm(`Сбросить переопределение «${PROMPT_LABELS[selectedId]}» до базового?`)) return;
      deleteMutation.mutate({ id: selectedId }, {
        onSuccess() {
          setEditorValues((prev) => {
            const next = { ...prev };
            delete next[selectedId];
            return next;
          });
        }
      });
    } else {
      setEditorValues((prev) => {
        const next = { ...prev };
        delete next[selectedId];
        return next;
      });
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="flex w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl" style={{ maxHeight: "90vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2 text-slate-800">
            <Settings2 className="size-4 text-slate-500" />
            <span className="font-medium text-sm">Переопределение промтов</span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1">
          {/* Left: prompt list + статусы-шпаргалка */}
          <div className="flex w-52 shrink-0 flex-col border-r border-slate-100 overflow-y-auto">
            <div className="flex flex-col gap-0.5 p-3">
              {PROMPT_IDS.map((id) => {
                const saved = getSavedTemplate(id);
                const edited = id in editorValues && editorValues[id] !== (saved ?? BASE_PROMPT_TEMPLATES[id]);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedId(id)}
                    className={cn(
                      "flex flex-col gap-0.5 rounded-lg px-3 py-2 text-left text-sm transition",
                      selectedId === id
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                    )}
                  >
                    <span className="font-medium leading-5">{PROMPT_LABELS[id]}</span>
                    <span className="text-[10px] leading-4">
                      {edited ? (
                        <span className="text-amber-600">не сохранено</span>
                      ) : saved ? (
                        <span className="text-emerald-600">переопределён</span>
                      ) : (
                        <span className="text-slate-400">базовый</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Шпаргалка по статусам */}
            <div className="mx-3 mb-3 mt-auto rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Статусы задач
              </p>
              <div className="space-y-1">
                {TASK_STATUSES.map(({ value, label, color }) => (
                  <button
                    key={value}
                    type="button"
                    title={`Копировать: ${value}`}
                    onClick={() => handleCopyStatus(value)}
                    className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 transition hover:bg-slate-100"
                  >
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${color}`}>
                      {label}
                    </span>
                    <code className="text-[10px] text-slate-400">
                      {copiedStatus === value ? "✓" : value}
                    </code>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: editor */}
          <div className="flex min-w-0 flex-1 flex-col gap-3 p-5 overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-slate-900">{PROMPT_LABELS[selectedId]}</p>
                <p className="text-xs text-slate-500">
                  {isOverridden ? "Переопределён — используется ваш шаблон" : "Базовый — переопределение не задано"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
                  showPreview
                    ? "bg-slate-800 text-white"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                <Eye className="size-3.5" />
                {showPreview ? "Редактор" : "Предпросмотр"}
              </button>
            </div>

            {showPreview ? (
              <div className="min-h-48 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 whitespace-pre-wrap">
                {previewText}
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                rows={12}
                value={currentValue}
                onChange={(e) => setEditorValues((prev) => ({ ...prev, [selectedId]: e.target.value }))}
                className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
              />
            )}

            {!showPreview && (
              <p className="text-xs text-slate-400">
                Используйте <code className="rounded bg-slate-100 px-1">{"{{projectName}}"}</code>,{" "}
                <code className="rounded bg-slate-100 px-1">{"{{taskTitle}}"}</code>,{" "}
                <code className="rounded bg-slate-100 px-1">{"{{taskId}}"}</code>,{" "}
                <code className="rounded bg-slate-100 px-1">{"{{projectPath}}"}</code>,{" "}
                <code className="rounded bg-slate-100 px-1">{"{{skillFilePath}}"}</code>{" "}
                для подстановки значений.
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
              {(isOverridden || isEdited) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={deleteMutation.isPending}
                >
                  <RotateCcw className="size-3.5" />
                  {isOverridden ? "Сбросить" : "Отменить правки"}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={!isEdited || upsertMutation.isPending}
              >
                <Save className="size-3.5" />
                {upsertMutation.isPending ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
