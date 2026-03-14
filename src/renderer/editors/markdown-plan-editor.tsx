/*
Purpose: Provide the editable Markdown textarea used for manual plan updates in the MVP.
Out of scope: Persistence, markdown preview rendering, and rich text editing.
*/
export interface MarkdownPlanEditorProps {
  onChange(value: string): void;
  value: string;
}

export function MarkdownPlanEditor({ onChange, value }: MarkdownPlanEditorProps) {
  return (
    <textarea
      className="app-editor"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Редактируйте Markdown-план вручную..."
    />
  );
}
