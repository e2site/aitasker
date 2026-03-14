/*
Назначение: WYSIWYG Markdown редактор на базе Milkdown с toolbar форматирования.
Не входит: Загрузка изображений, slash-команды, совместное редактирование.
*/
import type { Ctx } from "@milkdown/kit/ctx";
import { Editor, rootCtx, defaultValueCtx, commandsCtx } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import {
  wrapInHeadingCommand,
  wrapInBlockquoteCommand,
  createCodeBlockCommand,
  toggleStrongCommand,
  toggleEmphasisCommand,
  insertHrCommand,
} from "@milkdown/preset-commonmark";
import { insertTableCommand } from "@milkdown/preset-gfm";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { Milkdown, MilkdownProvider, useEditor, useInstance } from "@milkdown/react";
import { cn } from "@/renderer/components/ui/class-names";

export interface MilkdownEditorProps {
  className?: string;
  onChange(value: string): void;
  placeholder?: string;
  /** Increment to force-reset the editor (e.g. after task switch or form reset) */
  resetKey?: string | number;
  value: string;
}

interface InnerEditorProps {
  onChange(value: string): void;
  value: string;
}

function InnerEditor({ value, onChange }: InnerEditorProps) {
  useEditor((root) => {
    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, value);
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          onChange(markdown);
        });
      })
      .use(commonmark)
      .use(gfm)
      .use(listener);
  }, []);

  return <Milkdown />;
}

type ToolbarButton = {
  label: string;
  title: string;
  action: (ctx: Ctx) => void;
};

const TOOLBAR_BUTTONS: ToolbarButton[] = [
  { label: "H1", title: "Заголовок 1", action: (ctx) => ctx.get(commandsCtx).call(wrapInHeadingCommand.key, 1) },
  { label: "H2", title: "Заголовок 2", action: (ctx) => ctx.get(commandsCtx).call(wrapInHeadingCommand.key, 2) },
  { label: "H3", title: "Заголовок 3", action: (ctx) => ctx.get(commandsCtx).call(wrapInHeadingCommand.key, 3) },
  { label: "B", title: "Жирный", action: (ctx) => ctx.get(commandsCtx).call(toggleStrongCommand.key) },
  { label: "I", title: "Курсив", action: (ctx) => ctx.get(commandsCtx).call(toggleEmphasisCommand.key) },
  { label: "> цитата", title: "Цитата", action: (ctx) => ctx.get(commandsCtx).call(wrapInBlockquoteCommand.key) },
  { label: "</> код", title: "Блок кода", action: (ctx) => ctx.get(commandsCtx).call(createCodeBlockCommand.key) },
  { label: "⊞ таблица", title: "Таблица", action: (ctx) => ctx.get(commandsCtx).call(insertTableCommand.key) },
  { label: "— разделитель", title: "Горизонтальная линия", action: (ctx) => ctx.get(commandsCtx).call(insertHrCommand.key) },
];

function EditorToolbar() {
  const [loading, getEditor] = useInstance();

  function handleMouseDown(e: React.MouseEvent, button: ToolbarButton) {
    e.preventDefault(); // не снимать фокус с editor
    if (loading) return;
    const editor = getEditor();
    if (!editor) return;
    editor.action(button.action);
  }

  return (
    <div className="milkdown-toolbar">
      {TOOLBAR_BUTTONS.map((btn) => (
        <button
          key={btn.label}
          type="button"
          title={btn.title}
          disabled={loading}
          onMouseDown={(e) => handleMouseDown(e, btn)}
          className="milkdown-toolbar__btn"
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}

export function MilkdownEditor({ value, onChange, className, placeholder, resetKey }: MilkdownEditorProps) {
  return (
    <div
      className={cn("milkdown-wrapper", className)}
      data-placeholder={placeholder}
    >
      <MilkdownProvider>
        <EditorToolbar />
        <InnerEditor key={resetKey} value={value} onChange={onChange} />
      </MilkdownProvider>
    </div>
  );
}
