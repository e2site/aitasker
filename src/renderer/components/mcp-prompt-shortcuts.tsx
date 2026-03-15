/*
Назначение: Показывает компактные кнопки быстрого копирования MCP-промтов рядом с метаданными задачи.
Не входит: Подробное описание MCP workflow, карточка проекта и генерация самих prompt-данных.
*/
import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { TaskDetail } from "@/shared/contracts/desktop-api";
import { buildMcpPromptPresets } from "@/renderer/components/mcp-prompt-presets";
import { usePromptOverridesQuery } from "@/renderer/features/prompts/use-prompt-override-queries";
import { Button } from "@/renderer/components/ui/button";

async function copyToClipboard(text: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) {
    return false;
  }

  await navigator.clipboard.writeText(text);

  return true;
}

export interface McpPromptShortcutsProps {
  detail: TaskDetail;
}

export function McpPromptShortcuts({ detail }: McpPromptShortcutsProps) {
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const overridesQuery = usePromptOverridesQuery();
  const promptPresets = buildMcpPromptPresets(detail, overridesQuery.data ?? []);

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
    <section className="self-start rounded-2xl border border-slate-200 bg-slate-50 p-3 lg:sticky lg:top-6">
      <div className="mb-3 space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Быстрые MCP-промты</p>
        <p className="text-xs leading-5 text-slate-600">Скопируйте сценарий без перехода на вкладку workflow.</p>
      </div>

      <div className="space-y-2">
        {promptPresets.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            variant="outline"
            size="sm"
            className="h-auto w-full justify-start gap-2 px-3 py-2 text-[11px] leading-4 whitespace-normal"
            onClick={async () => {
              const copied = await copyToClipboard(preset.prompt);

              if (copied) {
                setCopiedPromptId(preset.id);
              }
            }}
          >
            {copiedPromptId === preset.id ? (
              <Check className="size-3.5 shrink-0" />
            ) : (
              <Copy className="size-3.5 shrink-0" />
            )}
            {copiedPromptId === preset.id ? "Скопировано" : preset.title}
          </Button>
        ))}
      </div>
    </section>
  );
}
