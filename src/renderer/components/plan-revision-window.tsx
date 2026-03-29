/*
Назначение: Открывает выбранную ревизию плана в отдельном окне с действиями копирования и восстановления.
Не входит: Отрисовка основного workspace задачи и хранение ревизий.
*/
import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Check, Copy, RotateCcw } from "lucide-react";
import type { PlanRevisionRecord } from "@/shared/contracts/desktop-api";
import { MarkdownPlanViewer } from "@/renderer/components/markdown-plan-viewer";
import { Button } from "@/renderer/components/ui/button";
import { parseManagedPlanContent } from "@/shared/plans/managed-plan-content";

function formatRevisionDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function copyDocumentStyles(targetDocument: Document): void {
  const styleNodes = document.querySelectorAll('link[rel="stylesheet"], style');

  styleNodes.forEach((node) => {
    targetDocument.head.appendChild(node.cloneNode(true));
  });
}

function createRevisionWindowDocument(targetWindow: Window, title: string): HTMLElement | null {
  targetWindow.document.title = title;
  targetWindow.document.body.innerHTML = '<div id="plan-revision-window-root"></div>';
  targetWindow.document.body.className = "bg-background text-foreground";

  // Inherit dark/light class from parent window
  const isDark = document.documentElement.classList.contains("dark");
  targetWindow.document.documentElement.classList.toggle("dark", isDark);

  copyDocumentStyles(targetWindow.document);

  return targetWindow.document.getElementById("plan-revision-window-root");
}

interface PlanRevisionWindowProps {
  onClose(): void;
  onRestore(): Promise<void> | void;
  revision: PlanRevisionRecord;
}

function PlanRevisionWindow(props: PlanRevisionWindowProps) {
  const [copied, setCopied] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const contentMd = useMemo(
    () => parseManagedPlanContent(props.revision.contentMd).renderedContentMd,
    [props.revision.contentMd]
  );

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <section className="mx-auto max-w-5xl space-y-4 rounded-3xl border bg-card p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Ревизия плана</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {formatRevisionDate(props.revision.createdAt)}
            </h1>
            <p className="text-sm text-foreground/70">Источник: {props.revision.source}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                if (!navigator.clipboard?.writeText) {
                  return;
                }

                await navigator.clipboard.writeText(contentMd);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              }}
            >
              {copied ? (
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
            <Button
              type="button"
              variant="outline"
              disabled={isRestoring}
              onClick={async () => {
                setIsRestoring(true);

                try {
                  await props.onRestore();
                  props.onClose();
                } finally {
                  setIsRestoring(false);
                }
              }}
            >
              <RotateCcw className="size-4" />
              {isRestoring ? "Возвращаем..." : "Сделать текущей"}
            </Button>
          </div>
        </div>

        <MarkdownPlanViewer contentMd={contentMd} />
      </section>
    </main>
  );
}

export interface OpenPlanRevisionWindowInput {
  onRestore(revisionId: string): Promise<void> | void;
  revision: PlanRevisionRecord;
}

export function openPlanRevisionWindow(input: OpenPlanRevisionWindowInput): void {
  const popup = window.open("", "", "popup=yes,width=1100,height=820,resizable=yes,scrollbars=yes");

  if (!popup) {
    return;
  }

  const container = createRevisionWindowDocument(popup, `Ревизия ${formatRevisionDate(input.revision.createdAt)}`);

  if (!container) {
    popup.close();
    return;
  }

  const root = createRoot(container);
  const cleanup = () => {
    root.unmount();
  };

  popup.addEventListener("beforeunload", cleanup, { once: true });
  root.render(
    <PlanRevisionWindow
      revision={input.revision}
      onClose={() => popup.close()}
      onRestore={() => input.onRestore(input.revision.id)}
    />
  );
}
