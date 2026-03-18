/*
Назначение: Отображает сохраненный Markdown-план с поддержкой таблиц и красивых блоков кода в панели задачи.
Поддерживает опциональную подсветку поиска через searchQuery (вставляет <mark class="search-highlight">).
Активация (класс "active") и scroll управляются через DOM в useTextSearch.
Не входит: Редактирование плана, сохранение данных и логика подсветки кода вне markdown-viewer.
*/
import { isValidElement, cloneElement, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownCodeBlock } from "@/renderer/components/markdown-code-block";
import { countMatches, HighlightedText } from "@/renderer/components/highlighted-text";

export interface MarkdownPlanViewerProps {
  contentMd: string;
  searchQuery?: string;
}

/**
 * Рекурсивно обходит children React-узлов, заменяя строковые узлы на HighlightedText.
 */
function highlightChildren(
  children: React.ReactNode,
  query: string,
): React.ReactNode {
  if (!query) return children;

  if (typeof children === "string") {
    if (countMatches(children, query) === 0) return children;
    return <HighlightedText text={children} query={query} />;
  }

  if (Array.isArray(children)) {
    return children.map((child, i) => (
      <span key={i}>
        {highlightChildren(child, query)}
      </span>
    ));
  }

  // React-элемент (например <strong>, <em>, <a>) — рекурсивно обходим его children
  if (isValidElement(children)) {
    const el = children as React.ReactElement<{ children?: React.ReactNode }>;
    const newChildren = highlightChildren(el.props.children, query);
    return cloneElement(el, {}, newChildren);
  }

  return children;
}

export function MarkdownPlanViewer({
  contentMd,
  searchQuery = "",
}: MarkdownPlanViewerProps) {
  const doHighlight = !!searchQuery;

  function wrapText(children: React.ReactNode): React.ReactNode {
    if (!doHighlight) return children;
    return highlightChildren(children, searchQuery);
  }

  return (
    <article className="app-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ children, className }) {
            const language = className?.match(/language-([\w-]+)/)?.[1] ?? null;
            const content = String(children).replace(/\n$/, "");
            const isInline = !language && !String(children).includes("\n");

            // Когда активен поиск — рендерим plain text чтобы <mark> мог вставляться в DOM
            if (doHighlight) {
              if (isInline) {
                return (
                  <code className={className}>
                    <HighlightedText text={content} query={searchQuery} />
                  </code>
                );
              }
              return (
                <div className="app-code-block">
                  <pre>
                    <code>
                      <HighlightedText text={content} query={searchQuery} />
                    </code>
                  </pre>
                </div>
              );
            }

            return (
              <MarkdownCodeBlock
                className={className}
                code={content}
                inline={isInline}
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
            const { children, ...rest } = props;
            return <th {...rest}>{wrapText(children)}</th>;
          },
          td(props: ComponentPropsWithoutRef<"td">) {
            const { children, ...rest } = props;
            return <td {...rest}>{wrapText(children)}</td>;
          },
          p({ children }) {
            return <p>{wrapText(children)}</p>;
          },
          li({ children }) {
            return <li>{wrapText(children)}</li>;
          },
          h1({ children }) {
            return <h1>{wrapText(children)}</h1>;
          },
          h2({ children }) {
            return <h2>{wrapText(children)}</h2>;
          },
          h3({ children }) {
            return <h3>{wrapText(children)}</h3>;
          },
          h4({ children }) {
            return <h4>{wrapText(children)}</h4>;
          },
          h5({ children }) {
            return <h5>{wrapText(children)}</h5>;
          },
          h6({ children }) {
            return <h6>{wrapText(children)}</h6>;
          },
          blockquote({ children }) {
            return <blockquote>{wrapText(children)}</blockquote>;
          },
        }}
      >
        {contentMd}
      </ReactMarkdown>
    </article>
  );
}
