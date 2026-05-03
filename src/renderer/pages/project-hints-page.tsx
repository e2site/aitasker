/*
Назначение: Показывает страницу подсказок проекта с поиском, таблицей и Markdown-панелью просмотра, создания и редактирования.
Не входит: Прямой доступ к SQLite/LanceDB, настройка embedding-модели и бизнес-логика HintContext.
*/
import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Eye, Lightbulb, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useAtomValue } from "jotai";
import { AppShell } from "@/renderer/components/app-shell";
import { MarkdownPlanViewer } from "@/renderer/components/markdown-plan-viewer";
import { Button } from "@/renderer/components/ui/button";
import { Input } from "@/renderer/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/renderer/components/ui/table";
import { cn } from "@/renderer/components/ui/class-names";
import { MilkdownEditor } from "@/renderer/editors/milkdown-editor";
import { selectedProjectIdAtom } from "@/renderer/features/projects/selected-project-id-state";
import { useProjectsQuery } from "@/renderer/features/projects/use-project-queries";
import {
  usePromptHintSearchQuery,
  usePromptHintsQuery
} from "@/renderer/features/prompt-hints/use-prompt-hint-queries";
import {
  useCreatePromptHintMutation,
  useDeletePromptHintMutation,
  useUpdatePromptHintMutation
} from "@/renderer/features/prompt-hints/use-prompt-hint-mutations";
import type { PromptHintRecord } from "@/shared/contracts/desktop-api";

const DEFAULT_SEARCH_LIMIT = 8;

type PanelMode = "view" | "create" | "edit";

export function ProjectHintsPage() {
  const selectedProjectId = useAtomValue(selectedProjectIdAtom);
  const { data: projects = [] } = useProjectsQuery();
  const hintsQuery = usePromptHintsQuery(selectedProjectId);
  const createMutation = useCreatePromptHintMutation();
  const updateMutation = useUpdatePromptHintMutation();
  const deleteMutation = useDeletePromptHintMutation();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchLimit, setSearchLimit] = useState(DEFAULT_SEARCH_LIMIT);
  const [selectedHintId, setSelectedHintId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>("view");
  const [createDraft, setCreateDraft] = useState("");
  const [editDraft, setEditDraft] = useState("");
  const [editorResetKey, setEditorResetKey] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const normalizedSearchQuery = searchQuery.trim();
  const searchResultsQuery = usePromptHintSearchQuery(
    selectedProjectId,
    normalizedSearchQuery,
    searchLimit
  );

  const selectedProject = selectedProjectId
    ? projects.find((project) => project.id === selectedProjectId) ?? null
    : null;
  const allHints = hintsQuery.data ?? [];
  const displayHints = normalizedSearchQuery ? searchResultsQuery.data ?? [] : allHints;
  const isDisplayFetching = normalizedSearchQuery ? searchResultsQuery.isFetching : hintsQuery.isFetching;
  const selectedHint = useMemo(
    () =>
      allHints.find((hint) => hint.id === selectedHintId) ??
      displayHints.find((hint) => hint.id === selectedHintId) ??
      null,
    [allHints, displayHints, selectedHintId]
  );
  const isBusy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const errorMessage =
    createMutation.error?.message ||
    updateMutation.error?.message ||
    deleteMutation.error?.message ||
    searchResultsQuery.error?.message ||
    hintsQuery.error?.message;

  useEffect(() => {
    setSelectedHintId(null);
    setPanelMode("view");
    setCreateDraft("");
    setEditDraft("");
    setEditorResetKey((key) => key + 1);
  }, [selectedProjectId]);

  useEffect(() => {
    if (panelMode === "create") {
      return;
    }

    if (displayHints.length === 0) {
      if (!isDisplayFetching) {
        setSelectedHintId(null);
      }
      return;
    }

    if (!selectedHintId) {
      setSelectedHintId(displayHints[0].id);
      return;
    }

    if (!displayHints.some((hint) => hint.id === selectedHintId) && !isDisplayFetching) {
      setSelectedHintId(displayHints[0].id);
      setPanelMode("view");
    }
  }, [displayHints, isDisplayFetching, panelMode, selectedHintId]);

  useEffect(() => {
    if (panelMode === "edit") {
      return;
    }

    setEditDraft(selectedHint?.text ?? "");
    setEditorResetKey((key) => key + 1);
  }, [panelMode, selectedHint?.id, selectedHint?.text]);

  useEffect(() => {
    if (!copiedId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopiedId(null);
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [copiedId]);

  function openCreatePanel() {
    setPanelMode("create");
    setCreateDraft("");
    setEditorResetKey((key) => key + 1);
  }

  function selectHint(hintId: string) {
    setSelectedHintId(hintId);
    setPanelMode("view");
  }

  function startEdit() {
    if (!selectedHint) {
      return;
    }

    setEditDraft(selectedHint.text);
    setPanelMode("edit");
    setEditorResetKey((key) => key + 1);
  }

  function cancelEdit() {
    setEditDraft(selectedHint?.text ?? "");
    setPanelMode("view");
    setEditorResetKey((key) => key + 1);
  }

  function handleCreate() {
    if (!selectedProjectId || !createDraft.trim()) {
      return;
    }

    createMutation.mutate(
      { projectId: selectedProjectId, text: createDraft },
      {
        onSuccess(hint) {
          setSearchQuery("");
          setCreateDraft("");
          setSelectedHintId(hint.id);
          setPanelMode("view");
          setEditorResetKey((key) => key + 1);
        }
      }
    );
  }

  function handleSave() {
    if (!selectedProjectId || !selectedHint || !editDraft.trim()) {
      return;
    }

    updateMutation.mutate(
      {
        projectId: selectedProjectId,
        hintId: selectedHint.id,
        text: editDraft
      },
      {
        onSuccess(hint) {
          setSelectedHintId(hint.id);
          setPanelMode("view");
        }
      }
    );
  }

  function handleDelete() {
    if (!selectedProjectId || !selectedHint) {
      return;
    }

    if (!window.confirm("Удалить подсказку?")) {
      return;
    }

    deleteMutation.mutate(
      { projectId: selectedProjectId, hintId: selectedHint.id },
      {
        onSuccess() {
          setSelectedHintId(null);
          setPanelMode("view");
          setEditDraft("");
          setEditorResetKey((key) => key + 1);
        }
      }
    );
  }

  function handleCopy(hint: PromptHintRecord) {
    if (!navigator.clipboard?.writeText) {
      return;
    }

    void navigator.clipboard.writeText(hint.text).then(() => {
      setCopiedId(hint.id);
    });
  }

  return (
    <AppShell>
      <div className="flex min-h-0 flex-1 flex-col gap-4" style={{ gridColumn: "1 / -1" }}>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <Lightbulb className="size-5 text-muted-foreground" />
              Подсказки
            </h1>
            <p className="text-sm text-muted-foreground">
              {selectedProject ? selectedProject.name : "Проект не выбран"}
            </p>
          </div>
        </header>

        {errorMessage ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        {!selectedProjectId ? (
          <section className="flex min-h-[420px] items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm text-muted-foreground">
            Выберите проект в левом меню, чтобы увидеть подсказки.
          </section>
        ) : (
          <div className="flex min-h-0 flex-1 gap-4">
            <div className="min-w-0 flex-1">
              <PromptHintsTable
                hints={displayHints}
                isFetching={isDisplayFetching}
                limit={searchLimit}
                query={searchQuery}
                searchActive={Boolean(normalizedSearchQuery)}
                selectedHintId={selectedHintId}
                totalCount={allHints.length}
                onLimitChange={setSearchLimit}
                onQueryChange={setSearchQuery}
                onSelect={selectHint}
              />
            </div>

            <div className="w-full max-w-[50%] min-w-[420px]">
              <PromptHintPanel
                copied={selectedHint ? copiedId === selectedHint.id : false}
                createDraft={createDraft}
                editDraft={editDraft}
                editorResetKey={editorResetKey}
                hint={selectedHint}
                isBusy={isBusy}
                mode={panelMode}
                onCancelCreate={() => {
                  setCreateDraft("");
                  setPanelMode("view");
                  setEditorResetKey((key) => key + 1);
                }}
                onCancelEdit={cancelEdit}
                onChangeCreateDraft={setCreateDraft}
                onChangeEditDraft={setEditDraft}
                onCopy={handleCopy}
                onCreate={handleCreate}
                onDelete={handleDelete}
                onOpenCreate={openCreatePanel}
                onSave={handleSave}
                onStartEdit={startEdit}
              />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

interface PromptHintsTableProps {
  hints: PromptHintRecord[];
  isFetching: boolean;
  limit: number;
  query: string;
  searchActive: boolean;
  selectedHintId: string | null;
  totalCount: number;
  onLimitChange(limit: number): void;
  onQueryChange(query: string): void;
  onSelect(hintId: string): void;
}

function PromptHintsTable({
  hints,
  isFetching,
  limit,
  query,
  searchActive,
  selectedHintId,
  totalCount,
  onLimitChange,
  onQueryChange,
  onSelect
}: PromptHintsTableProps) {
  const emptyText = searchActive
    ? isFetching
      ? "Поиск..."
      : "Ничего не найдено"
    : isFetching
      ? "Загрузка..."
      : "Подсказок пока нет";

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Поиск подсказок..."
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="pl-8"
          />
        </div>

        <Input
          type="number"
          min={1}
          max={50}
          value={limit}
          onChange={(event) => onLimitChange(normalizeSearchLimit(event.target.value))}
          className="w-20"
          title="Лимит поиска"
        />

        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {searchActive ? `${hints.length} из ${totalCount}` : `${totalCount} подсказок`}
        </span>
      </div>

      {hints.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed py-16 text-sm text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        <div className="min-h-0 overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Подсказка</TableHead>
                <TableHead>Создано</TableHead>
                <TableHead>Обновлено</TableHead>
                <TableHead>ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hints.map((hint) => {
                const active = hint.id === selectedHintId;

                return (
                  <TableRow
                    key={hint.id}
                    data-state={active ? "selected" : undefined}
                    className="cursor-pointer"
                    onClick={() => onSelect(hint.id)}
                  >
                    <TableCell>
                      <div className="max-w-xl">
                        <p className="line-clamp-2 font-medium leading-5">{createPreview(hint.text)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatShortDate(hint.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatShortDate(hint.updatedAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {hint.id.slice(0, 8).toUpperCase()}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

interface PromptHintPanelProps {
  copied: boolean;
  createDraft: string;
  editDraft: string;
  editorResetKey: number;
  hint: PromptHintRecord | null;
  isBusy: boolean;
  mode: PanelMode;
  onCancelCreate(): void;
  onCancelEdit(): void;
  onChangeCreateDraft(value: string): void;
  onChangeEditDraft(value: string): void;
  onCopy(hint: PromptHintRecord): void;
  onCreate(): void;
  onDelete(): void;
  onOpenCreate(): void;
  onSave(): void;
  onStartEdit(): void;
}

function PromptHintPanel({
  copied,
  createDraft,
  editDraft,
  editorResetKey,
  hint,
  isBusy,
  mode,
  onCancelCreate,
  onCancelEdit,
  onChangeCreateDraft,
  onChangeEditDraft,
  onCopy,
  onCreate,
  onDelete,
  onOpenCreate,
  onSave,
  onStartEdit
}: PromptHintPanelProps) {
  const dirty = hint ? editDraft !== hint.text : false;

  return (
    <section className="app-card flex min-h-[720px] flex-col">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">
            {mode === "create" ? "NEW-HINT" : hint ? `HINT-${hint.id.slice(0, 8).toUpperCase()}` : "HINT"}
          </p>
          <h2 className="mt-1 truncate text-xl font-semibold">
            {mode === "create" ? "Новая подсказка" : "Подсказка"}
          </h2>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={mode === "create" ? "secondary" : "outline"}
            disabled={isBusy}
            onClick={onOpenCreate}
          >
            <Plus className="size-3.5" />
            Создать
          </Button>

          {mode === "view" && hint ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isBusy}
                onClick={() => onCopy(hint)}
              >
                {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                {copied ? "Скопировано" : "Копировать"}
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={onStartEdit}>
                <Pencil className="size-3.5" />
                Редактировать
              </Button>
              <Button type="button" size="sm" variant="destructive" disabled={isBusy} onClick={onDelete}>
                <Trash2 className="size-3.5" />
                Удалить
              </Button>
            </>
          ) : null}

          {mode === "edit" ? (
            <Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={onCancelEdit}>
              <Eye className="size-3.5" />
              Просмотр
            </Button>
          ) : null}
        </div>
      </div>

      {mode === "create" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <MilkdownEditor
            className="app-editor min-h-[520px]"
            value={createDraft}
            onChange={onChangeCreateDraft}
            resetKey={`create-${editorResetKey}`}
            placeholder="Новая Markdown-подсказка..."
          />

          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={isBusy} onClick={onCancelCreate}>
              <X className="size-4" />
              Отмена
            </Button>
            <Button type="button" disabled={isBusy || !createDraft.trim()} onClick={onCreate}>
              <Plus className="size-4" />
              {isBusy ? "Создаём..." : "Создать"}
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "edit" && hint ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <MilkdownEditor
            className="app-editor min-h-[520px]"
            value={editDraft}
            onChange={onChangeEditDraft}
            resetKey={`edit-${hint.id}-${editorResetKey}`}
            placeholder="Редактируйте Markdown-подсказку..."
          />

          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={isBusy} onClick={onCancelEdit}>
              <X className="size-4" />
              Отмена
            </Button>
            <Button type="button" disabled={isBusy || !editDraft.trim() || !dirty} onClick={onSave}>
              <Save className="size-4" />
              {isBusy ? "Сохраняем..." : "Сохранить"}
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "view" ? (
        hint ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-4 flex flex-wrap gap-4 border-b pb-4 text-xs text-muted-foreground">
              <span>Создано: {formatFullDate(hint.createdAt)}</span>
              <span>Обновлено: {formatFullDate(hint.updatedAt)}</span>
            </div>

            <div className={cn("min-h-0 flex-1 overflow-y-auto", hint.text ? "" : "text-muted-foreground")}>
              {hint.text ? (
                <MarkdownPlanViewer contentMd={hint.text} />
              ) : (
                <p className="text-sm">Подсказка пустая.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
            Выберите подсказку слева или создайте новую.
          </div>
        )
      ) : null}
    </section>
  );
}

function createPreview(value: string): string {
  const compact = value
    .replace(/```[\s\S]*?```/g, " блок кода ")
    .replace(/[#*_`>\-[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return compact || "Без текста";
}

function normalizeSearchLimit(value: string): number {
  return Math.min(50, Math.max(1, Number(value) || DEFAULT_SEARCH_LIMIT));
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "2-digit"
  }).format(new Date(value));
}

function formatFullDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
