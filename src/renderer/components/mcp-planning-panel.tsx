/*
Назначение: Показывает рабочий MCP-flow по задаче и подробные готовые сценарии промтов для MCP-агента.
Не входит: Отрисовка общего layout карточки задачи, быстрые aside-кнопки и смена статуса из интерфейса.
*/
import { useEffect, useState } from "react";
import { Check, Copy, Workflow } from "lucide-react";
import type { TaskDetail } from "@/shared/contracts/desktop-api";
import { buildMcpPromptPresets } from "@/renderer/components/mcp-prompt-presets";
import { usePromptOverridesQuery } from "@/renderer/features/prompts/use-prompt-override-queries";
import { Button } from "@/renderer/components/ui/button";

export interface McpPlanningPanelProps {
  detail: TaskDetail;
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) {
    return false;
  }

  await navigator.clipboard.writeText(text);

  return true;
}

export function McpPlanningPanel({ detail }: McpPlanningPanelProps) {
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const overridesQuery = usePromptOverridesQuery();
  const promptPresets = buildMcpPromptPresets(detail, overridesQuery.data ?? []);
  const projectProfileReady = detail.project.isProfileComplete;

  useEffect(() => {
    if (!copiedPromptId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopiedPromptId(null);
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copiedPromptId]);

  return (
    <div className="space-y-5">
      <section className="mcp-hero-card">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="app-label">Планирование через MCP</p>
            <h3 className="text-xl font-semibold tracking-tight text-foreground">Базовый flow по задаче</h3>
            <p className="max-w-3xl text-sm leading-6 text-foreground/70">
              Внешний агент должен работать через короткие JSON-команды с явным `projectId`, чтобы сценарий не
              зависел от случайно сменившегося активного проекта.
            </p>
          </div>
          <div className="rounded-2xl border bg-card px-4 py-3 text-right shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Профиль проекта</p>
            <p className={`mt-1 text-sm font-semibold ${projectProfileReady ? "text-emerald-700" : "text-amber-700"}`}>
              {projectProfileReady ? "Заполнен" : "Нужно заполнить"}
            </p>
          </div>
        </div>
      </section>

      <section className="mcp-flow-grid">
        <article className="mcp-flow-card">
          <div className="mcp-flow-card__index">1</div>
          <p className="mcp-flow-card__title">Активация проекта</p>
          <p className="mcp-flow-card__text">
            Передать короткую JSON-команду с `projectId`, активировать проект и при необходимости проверить карточку.
          </p>
        </article>
        <article className="mcp-flow-card">
          <div className="mcp-flow-card__index">2</div>
          <p className="mcp-flow-card__title">Планирование</p>
          <p className="mcp-flow-card__text">
            Использовать команду с `taskId`, перевести задачу в `planning`, прочитать задачу и план, затем сохранить план.
          </p>
        </article>
        <article className="mcp-flow-card">
          <div className="mcp-flow-card__index">3</div>
          <p className="mcp-flow-card__title">Реализация</p>
          <p className="mcp-flow-card__text">
            После сохранения плана держать статус `implementation` и фиксировать решения через `append_plan_extension`
            или `append_plan_improvement`.
          </p>
        </article>
        <article className="mcp-flow-card">
          <div className="mcp-flow-card__index">4</div>
          <p className="mcp-flow-card__title">Завершение</p>
          <p className="mcp-flow-card__text">
            После выполнения шагов плана оставить финальные расширения или доработки и перевести задачу в `completed`.
          </p>
        </article>
      </section>

      <section className="rounded-2xl border bg-muted/50 p-4">
        <div className="flex items-center gap-2 text-foreground">
          <Workflow className="size-4" />
          <p className="text-sm font-semibold">Текущее состояние проекта и задачи</p>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-card p-3 text-sm text-foreground/70 shadow-sm">
            <p className="font-semibold text-foreground">Проект</p>
            <p className="mt-1">{detail.task.projectName}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Путь: {detail.project.rootPath || "не заполнен"}
              <br />
              Языки: {detail.project.languages.length ? detail.project.languages.join(", ") : "не заполнены"}
              <br />
              SKILL.md: {detail.project.skillFilePath || "не указан"}
            </p>
          </div>
          <div className="rounded-xl bg-card p-3 text-sm text-foreground/70 shadow-sm">
            <p className="font-semibold text-foreground">Задача</p>
            <p className="mt-1">{detail.task.title}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Task ID: {detail.task.id}
              <br />
              Текущий статус: {detail.task.status}
              <br />
              План: {detail.plan ? "уже сохранен" : "еще не создан"}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <p className="app-label">Готовые кейсы</p>
          <h3 className="text-lg font-semibold tracking-tight text-foreground">Промты для копирования</h3>
          <p className="text-sm leading-6 text-foreground/70">
            Используйте готовые сценарии для старта: активация проекта, планирование, создание подзадач,
            уточнение, реализация, реализация с подзадачами, сжатие переписки в план, завершение и обновление `SKILL.md`.
          </p>
        </div>

        <div className="space-y-3">
          {promptPresets.map((preset) => (
            <article key={preset.id} className="mcp-prompt-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{preset.title}</p>
                  <p className="text-sm leading-6 text-foreground/70">{preset.description}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mcp-copy-button"
                  onClick={async () => {
                    const copied = await copyToClipboard(preset.prompt);

                    if (copied) {
                      setCopiedPromptId(preset.id);
                    }
                  }}
                >
                  {copiedPromptId === preset.id ? (
                    <>
                      <Check className="size-4" />
                      Скопировано
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" />
                      Копировать
                    </>
                  )}
                </Button>
              </div>

              <div className="mcp-prompt-block">{preset.prompt}</div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
