/*
Purpose: WYSIWYG Markdown editor for manual plan updates.
Out of scope: Persistence and markdown preview rendering.
*/
import { MilkdownEditor } from "@/renderer/editors/milkdown-editor";

export interface MarkdownPlanEditorProps {
  onChange(value: string): void;
  resetKey?: string | number;
  value: string;
}

export function MarkdownPlanEditor({ onChange, value, resetKey }: MarkdownPlanEditorProps) {
  return (
    <MilkdownEditor
      className="app-editor"
      value={value}
      onChange={onChange}
      resetKey={resetKey}
      placeholder="Редактируйте Markdown-план..."
    />
  );
}
