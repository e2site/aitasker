/*
Назначение: Отображает сохраненный Markdown-план с поддержкой таблиц и красивых блоков кода в панели задачи.
Не входит: Редактирование плана, сохранение данных и логика подсветки кода вне markdown-viewer.
*/
import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownCodeBlock } from "@/renderer/components/markdown-code-block";

export interface MarkdownPlanViewerProps {
  contentMd: string;
}

export function MarkdownPlanViewer({ contentMd }: MarkdownPlanViewerProps) {
  return (
    <article className="app-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ children, className }) {
            const language = className?.match(/language-([\w-]+)/)?.[1] ?? null;
            const content = String(children).replace(/\n$/, "");

            return (
              <MarkdownCodeBlock
                className={className}
                code={content}
                inline={!language && !String(children).includes("\n")}
                language={language}
              />
            );
          },
          table(props) {
            return (
              <div className="app-markdown-table-wrap">
                <table {...props} />
              </div>
            );
          },
          th(props: ComponentPropsWithoutRef<"th">) {
            return <th {...props} />;
          },
          td(props: ComponentPropsWithoutRef<"td">) {
            return <td {...props} />;
          },
        }}
      >
        {contentMd}
      </ReactMarkdown>
    </article>
  );
}
