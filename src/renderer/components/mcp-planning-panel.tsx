/*
Назначение: Показывает рабочий MCP-flow по задаче и подробные готовые сценарии промтов для MCP-агента.
Не входит: Отрисовка общего layout карточки задачи, быстрые aside-кнопки и смена статуса из интерфейса.
*/
import { useEffect, useState } from "react";
import { Check, Copy, Workflow } from "lucide-react";
import type { TaskDetail } from "@/shared/contracts/desktop-api";
import { buildMcpPromptPresets } from "@/renderer/components/mcp-prompt-presets";
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
  const promptPresets = buildMcpPromptPresets(detail);
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
            <h3 className="text-xl font-semibold tracking-tight text-slate-950">Базовый flow по задаче</h3>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              Внешний агент должен сначала активировать проект, проверить карточку проекта, затем перейти к
              планированию или реализации задачи в рамках MCP-инструментов AITasker.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Профиль проекта</p>
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
            Вызвать `activate_project`, затем `get_active_project` и убедиться, что карточка проекта заполнена.
          </p>
        </article>
        <article className="mcp-flow-card">
          <div className="mcp-flow-card__index">2</div>
          <p className="mcp-flow-card__title">Планирование</p>
          <p className="mcp-flow-card__text">
            Разрешить задачу, выставить статус `planning`, прочитать задачу и план, затем сохранить план обратно.
          </p>
        </article>
        <article className="mcp-flow-card">
          <div className="mcp-flow-card__index">3</div>
          <p className="mcp-flow-card__title">Реализация</p>
          <p className="mcp-flow-card__text">
            После сохранения плана перевести задачу в `implementation` и использовать `append_plan_extension` или
            `append_plan_improvement` для уточнений, решений и рисков.
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

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-slate-900">
          <Workflow className="size-4" />
          <p className="text-sm font-semibold">Текущее состояние проекта и задачи</p>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-white p-3 text-sm text-slate-600 shadow-sm">
            <p className="font-semibold text-slate-900">Проект</p>
            <p className="mt-1">{detail.task.projectName}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Путь: {detail.project.rootPath || "не заполнен"}
              <br />
              Языки: {detail.project.languages.length ? detail.project.languages.join(", ") : "не заполнены"}
              <br />
              SKILL.md: {detail.project.skillFilePath || "не указан"}
            </p>
          </div>
          <div className="rounded-xl bg-white p-3 text-sm text-slate-600 shadow-sm">
            <p className="font-semibold text-slate-900">Задача</p>
            <p className="mt-1">{detail.task.title}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
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
          <h3 className="text-lg font-semibold tracking-tight text-slate-950">Промты для копирования</h3>
          <p className="text-sm leading-6 text-slate-600">
            Используйте готовые сценарии для старта: активация проекта, планирование, уточнение, реализация,
            сжатие переписки в план, завершение и обновление `SKILL.md`.
          </p>
        </div>

        <div className="space-y-3">
          {promptPresets.map((preset) => (
            <article key={preset.id} className="mcp-prompt-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">{preset.title}</p>
                  <p className="text-sm leading-6 text-slate-600">{preset.description}</p>
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
