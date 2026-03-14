/*
Purpose: Render the saved task plan as readable Markdown inside the detail pane.
Out of scope: Plan editing state and persistence.
*/
import ReactMarkdown from "react-markdown";

export interface MarkdownPlanViewerProps {
  contentMd: string;
}

export function MarkdownPlanViewer({ contentMd }: MarkdownPlanViewerProps) {
  return (
    <article className="app-markdown">
      <ReactMarkdown>{contentMd}</ReactMarkdown>
    </article>
  );
}
