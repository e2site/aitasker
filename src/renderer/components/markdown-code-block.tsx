/*
Назначение: Рендерит inline-код и fenced code blocks для markdown с подсветкой через Shiki.
Не входит: Парсинг markdown-документа целиком и настройка общих стилей markdown-контейнера.
*/
import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";
import { cn } from "@/renderer/components/ui/class-names";

const highlightedCodeCache = new Map<string, string>();

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function highlightCode(code: string, language: string | null): Promise<string> {
  const normalizedLanguage = language?.trim() || "text";
  const cacheKey = `${normalizedLanguage}::${code}`;
  const cached = highlightedCodeCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  try {
    const html = await codeToHtml(code, {
      lang: normalizedLanguage,
      themes: {
        light: "github-light",
        dark: "github-dark"
      },
      defaultColor: false
    });

    highlightedCodeCache.set(cacheKey, html);

    return html;
  } catch {
    const html = `<pre class="shiki shiki-fallback" tabindex="0"><code>${escapeHtml(code)}</code></pre>`;
    highlightedCodeCache.set(cacheKey, html);

    return html;
  }
}

export interface MarkdownCodeBlockProps {
  className?: string;
  code: string;
  inline: boolean;
  language: string | null;
}

export function MarkdownCodeBlock(props: MarkdownCodeBlockProps) {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);

  useEffect(() => {
    if (props.inline) {
      return;
    }

    let cancelled = false;

    highlightCode(props.code, props.language).then((html) => {
      if (!cancelled) {
        setHighlightedHtml(html);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [props.code, props.inline, props.language]);

  if (props.inline) {
    return <code className={cn(props.className)}>{props.code}</code>;
  }

  if (!highlightedHtml) {
    return (
      <pre className="app-code-block">
        <code>{props.code}</code>
      </pre>
    );
  }

  return (
    <div
      className="app-code-block"
      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
    />
  );
}
