/*
Назначение: Отрисовывает страницу настройки базовых и переопределённых MCP-промтов.
Не входит: Хранение промтов, модальный режим редактирования и выполнение MCP-команд.
*/
import { useRef, useState } from "react";
import { Eye, RotateCcw, Save } from "lucide-react";
import {
  BASE_PROMPT_TEMPLATES,
  getPromptVars,
  type PromptId,
} from "@/renderer/components/mcp-prompt-presets";
import { previewPromptTemplate, renderPromptTemplate } from "@/shared/prompts/prompt-template";
import {
  useDeletePromptOverrideMutation,
  usePromptOverridesQuery,
  useUpsertPromptOverrideMutation,
} from "@/renderer/features/prompts/use-prompt-override-queries";
import { TASK_STATUS_LIST } from "@/renderer/features/tasks/task-status-meta";
import { cn } from "@/renderer/components/ui/class-names";
import { Button } from "@/renderer/components/ui/button";
import type { PromptOverrideRecord } from "@/shared/contracts/desktop-api";

const PROMPT_LABELS: Record<PromptId, string> = {
  "activate-project": "Активация проекта",
  "agent-task-prompt": "Создать задачу в агенте",
  "plan-task": "Планирование задачи",
  "create-subtasks": "Создать подзадачи",
  "reload-context": "Перезагрузка контекста",
  "clarify-plan": "Уточнение плана",
  "implementation": "Переход к реализации",
  "implementation-with-subtasks": "Реализация с подзадачами",
  "finish-task": "Завершение задачи",
  "consolidate-discussion": "Сжать переписку в план",
  "project-skill": "Создание SKILL.md",
  "search-hints": "Поиск подсказок",
  "save-hints": "Сохранить инсайты",
};

const PROMPT_IDS = Object.keys(BASE_PROMPT_TEMPLATES) as PromptId[];

export function PromptOverridesPage() {
  const overridesQuery = usePromptOverridesQuery();
  const upsertMutation = useUpsertPromptOverrideMutation();
  const deleteMutation = useDeletePromptOverrideMutation();

  const [selectedId, setSelectedId] = useState<PromptId>(PROMPT_IDS[0]);
  const [editorValues, setEditorValues] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [copiedStatus, setCopiedStatus] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const overrides: PromptOverrideRecord[] = overridesQuery.data ?? [];

  function getSavedTemplate(id: PromptId): string | null {
    return overrides.find((o) => o.id === id)?.template ?? null;
  }

  function getEditorValue(id: PromptId): string {
    if (id in editorValues) return editorValues[id];
    return getSavedTemplate(id) ?? BASE_PROMPT_TEMPLATES[id];
  }

  function handleCopyStatus(value: string) {
    if (!navigator.clipboard?.writeText) return;
    void navigator.clipboard.writeText(value).then(() => {
      setCopiedStatus(value);
      window.setTimeout(() => setCopiedStatus((cur) => (cur === value ? null : cur)), 1500);
    });
  }

  const currentValue = getEditorValue(selectedId);
  const savedTemplate = getSavedTemplate(selectedId);
  const isOverridden = savedTemplate !== null;
  const isEdited =
    selectedId in editorValues &&
    editorValues[selectedId] !== (savedTemplate ?? BASE_PROMPT_TEMPLATES[selectedId]);

  const previewText = showPreview
    ? previewPromptTemplate(currentValue, [])
    : currentValue;

  function handleSave() {
    upsertMutation.mutate(
      { id: selectedId, template: currentValue },
      {
        onSuccess() {
          setEditorValues((prev) => {
            const next = { ...prev };
            delete next[selectedId];
            return next;
          });
        },
      }
    );
  }

  function handleReset() {
    if (isOverridden) {
      if (!window.confirm(`Сбросить переопределение «${PROMPT_LABELS[selectedId]}» до базового?`)) return;
      deleteMutation.mutate(
        { id: selectedId },
        {
          onSuccess() {
            setEditorValues((prev) => {
              const next = { ...prev };
              delete next[selectedId];
              return next;
            });
          },
        }
      );
    } else {
      setEditorValues((prev) => {
        const next = { ...prev };
        delete next[selectedId];
        return next;
      });
    }
  }

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      {/* Left: prompt list + статусы */}
      <div className="flex w-48 shrink-0 flex-col gap-1">
        <div className="flex flex-col gap-0.5">
          {PROMPT_IDS.map((id) => {
            const saved = getSavedTemplate(id);
            const edited =
              id in editorValues &&
              editorValues[id] !== (saved ?? BASE_PROMPT_TEMPLATES[id]);
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedId(id)}
                className={cn(
                  "flex flex-col gap-0.5 rounded-lg px-3 py-2 text-left text-sm transition",
                  selectedId === id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <span className="font-medium leading-5">{PROMPT_LABELS[id]}</span>
                <span className="text-[10px] leading-4">
                  {edited ? (
                    <span className="text-amber-600">не сохранено</span>
                  ) : saved ? (
                    <span className="text-emerald-600">переопределён</span>
                  ) : (
                    <span className="text-muted-foreground">базовый</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Шпаргалка по статусам */}
        <div className="mt-auto rounded-lg border bg-muted/50 px-3 py-2.5">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Статусы задач
          </p>
          <div className="space-y-1">
            {TASK_STATUS_LIST.map(({ value, label, promptGuideClass }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleCopyStatus(value)}
                className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 transition hover:bg-muted"
              >
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${promptGuideClass}`}>
                  {label}
                </span>
                <code className="text-[10px] text-muted-foreground">
                  {copiedStatus === value ? "✓" : value}
                </code>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: editor */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold">{PROMPT_LABELS[selectedId]}</p>
            <p className="text-xs text-muted-foreground">
              {isOverridden
                ? "Переопределён — используется ваш шаблон"
                : "Базовый — переопределение не задано"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
              showPreview
                ? "bg-foreground text-background"
                : "border text-muted-foreground hover:bg-muted"
            )}
          >
            <Eye className="size-3.5" />
            {showPreview ? "Редактор" : "Предпросмотр"}
          </button>
        </div>

        {showPreview ? (
          <div className="min-h-48 rounded-lg border bg-muted/50 px-3 py-2.5 text-sm whitespace-pre-wrap">
            {previewText}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            rows={14}
            value={currentValue}
            onChange={(e) =>
              setEditorValues((prev) => ({ ...prev, [selectedId]: e.target.value }))
            }
            className="w-full resize-y rounded-lg border px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground focus:border-foreground/30 focus:ring-1 focus:ring-foreground/20"
          />
        )}

        {!showPreview && (
          <p className="text-xs text-muted-foreground">
            Используйте <code className="rounded bg-muted px-1">{"{{projectName}}"}</code>,{" "}
            <code className="rounded bg-muted px-1">{"{{taskTitle}}"}</code>,{" "}
            <code className="rounded bg-muted px-1">{"{{taskId}}"}</code>,{" "}
            <code className="rounded bg-muted px-1">{"{{projectPath}}"}</code>,{" "}
            <code className="rounded bg-muted px-1">{"{{skillFilePath}}"}</code>{" "}
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
  );
}
