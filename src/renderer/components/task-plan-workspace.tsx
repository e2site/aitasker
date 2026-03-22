/*
Назначение: Показывает базовый план задачи, MCP-ревизии, открытые вопросы и единый диалог-тред по плану.
Не входит: Общий layout карточки задачи, смена статуса и MCP-подсказки.
*/
import { useEffect, useRef, useState } from "react";
import { Copy, History, MessageSquarePlus } from "lucide-react";
import type { TaskDetail } from "@/shared/contracts/desktop-api";
import { MarkdownPlanViewer } from "@/renderer/components/markdown-plan-viewer";
import { buildPlanCommentPrompt } from "@/renderer/components/mcp-prompt-presets";
import { openPlanRevisionWindow } from "@/renderer/components/plan-revision-window";
import { Button } from "@/renderer/components/ui/button";
import { MarkdownPlanEditor } from "@/renderer/editors/markdown-plan-editor";
import { MilkdownEditor } from "@/renderer/editors/milkdown-editor";
import type { PlanCommentRecord, PlanQuestionRecord } from "@/shared/contracts/desktop-api";
import {
  buildThreadItems,
  type CommentKind,
  type ThreadKind,
} from "@/renderer/features/plans/build-thread-items";

const KIND_LABEL: Record<CommentKind, string> = {
  extension: "расширение",
  improvement: "доработка",
};

const KIND_BADGE_CLASSES: Record<ThreadKind, string> = {
  discussion: "bg-slate-100 text-slate-700",
  extension: "bg-sky-100 text-sky-700",
  improvement: "bg-violet-100 text-violet-700",
};

function formatRevisionDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCommentDate(iso: string | null): string {
  if (!iso) return "без времени";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "без времени";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

async function copyText(text: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) {
    return false;
  }

  await navigator.clipboard.writeText(text);

  return true;
}

export interface TaskPlanWorkspaceProps {
  detail: TaskDetail;
  draftPlan: string;
  editorMode: "view" | "edit";
  isAnsweringPlanQuestion: boolean;
  isAppendingPlanExtension: boolean;
  isAppendingPlanImprovement: boolean;
  isDeletingTask: boolean;
  isRestoringRevision: boolean;
  isSavingPlan: boolean;
  searchQuery?: string;
  onAnswerPlanQuestion(taskId: string, questionId: string, answer: string): void;
  onAppendPlanExtension(taskId: string, content: string): void;
  onAppendPlanImprovement(taskId: string, content: string): void;
  onChangeDraftPlan(value: string): void;
  onRestoreRevision(revisionId: string): void;
  onSavePlan(taskId: string, contentMd: string): void;
  onSetEditorMode(mode: "view" | "edit"): void;
}

function toBlockquote(text: string): string {
  return text.trim().split("\n").map((line) => `> ${line}`).join("\n") + "\n\n";
}

export function TaskPlanWorkspace(props: TaskPlanWorkspaceProps) {
  const [selectedRevisionId, setSelectedRevisionId] = useState("");
  const [copiedCommentPromptId, setCopiedCommentPromptId] = useState<string | null>(null);
  const [composerDraft, setComposerDraft] = useState("");
  const [composerKind, setComposerKind] = useState<CommentKind>("extension");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerResetKey, setComposerResetKey] = useState(0);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [selectionPopover, setSelectionPopover] = useState<{ top: number; left: number; text: string } | null>(null);
  const planRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const revisions = props.detail.planRevisions;
  const dirty = props.draftPlan !== (props.detail.plan?.contentMd ?? "");

  const sq = props.searchQuery ?? "";
  const isBusy =
    props.isDeletingTask ||
    props.isAppendingPlanExtension ||
    props.isAppendingPlanImprovement ||
    props.isAnsweringPlanQuestion;

  // Единый хронологический тред
  const openQuestions = props.detail.planQuestions.filter((q) => !q.answeredAt);
  const threadItems = buildThreadItems(props.detail.planComments, props.detail.planQuestions);

  useEffect(() => {
    setSelectedRevisionId("");
  }, [props.detail.task.id, revisions]);

  useEffect(() => {
    setComposerDraft("");
    setComposerOpen(false);
    setComposerKind("extension");
    setQuestionAnswers({});
    setComposerResetKey((k) => k + 1);
  }, [props.detail.task.id]);

  useEffect(() => {
    if (!copiedCommentPromptId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopiedCommentPromptId(null);
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copiedCommentPromptId]);

  // Selection popover: show "Обсудить" button when text is selected inside plan viewer
  useEffect(() => {
    function handleMouseUp() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !planRef.current) {
        setSelectionPopover(null);
        return;
      }

      const text = selection.toString().trim();
      if (!text) {
        setSelectionPopover(null);
        return;
      }

      // Check selection is inside planRef
      const range = selection.getRangeAt(0);
      if (!planRef.current.contains(range.commonAncestorContainer)) {
        setSelectionPopover(null);
        return;
      }

      const rangeRect = range.getBoundingClientRect();
      const containerRect = planRef.current.getBoundingClientRect();

      setSelectionPopover({
        top: rangeRect.top - containerRect.top,
        left: rangeRect.left - containerRect.left + rangeRect.width / 2,
        text,
      });
    }

    function handleMouseDown(e: MouseEvent) {
      // Hide popover unless clicking the popover button itself
      const target = e.target as HTMLElement;
      if (target.closest(".selection-popover")) return;
      setSelectionPopover(null);
    }

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, []);

  return (
    <div className="plan-workspace">
      <div className="space-y-3">
        {props.editorMode === "edit" ? (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={props.isDeletingTask || props.isRestoringRevision}
              onClick={() => {
                props.onChangeDraftPlan(props.detail.plan?.contentMd ?? "");
                props.onSetEditorMode("view");
              }}
            >
              Отмена
            </Button>
            <Button
              type="button"
              disabled={!dirty || props.isSavingPlan || props.isDeletingTask || props.isRestoringRevision}
              onClick={() => props.onSavePlan(props.detail.task.id, props.draftPlan)}
            >
              {props.isSavingPlan ? "Сохраняем..." : "Сохранить"}
            </Button>
          </div>
        ) : null}

        {props.detail.plan || props.editorMode === "edit" ? (
          props.editorMode === "edit" ? (
            <MarkdownPlanEditor value={props.draftPlan} onChange={props.onChangeDraftPlan} />
          ) : props.detail.plan ? (
            <div className="space-y-4">
              {/* Ревизии */}
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <History className="size-4 text-slate-500" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Ревизии</p>
                      <p className="text-xs text-slate-500">
                        {revisions.length === 0
                          ? "Ревизии появляются только после пересохранения плана со стороны MCP."
                          : "Выберите ревизию, чтобы открыть ее в новом окне."}
                      </p>
                    </div>
                  </div>
                  <div className="min-w-[280px] flex-1 md:max-w-md">
                    <select
                      className="app-input"
                      disabled={revisions.length === 0}
                      value={selectedRevisionId}
                      onChange={(event) => {
                        const revisionId = event.target.value;
                        setSelectedRevisionId(revisionId);
                        const revision = revisions.find((item) => item.id === revisionId);
                        if (!revision) return;
                        openPlanRevisionWindow({
                          revision,
                          onRestore: (nextRevisionId) => props.onRestoreRevision(nextRevisionId),
                        });
                        setSelectedRevisionId("");
                      }}
                    >
                      <option value="">
                        {revisions.length === 0 ? "Ревизий пока нет" : "Выберите ревизию"}
                      </option>
                      {revisions.map((revision, index) => (
                        <option key={revision.id} value={revision.id}>
                          {`Ревизия #${revisions.length - index} · ${formatRevisionDate(revision.createdAt)} · ${revision.source}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              {/* Базовый план */}
              <div ref={planRef} className="relative">
                <MarkdownPlanViewer
                  contentMd={props.detail.plan?.contentMd ?? ""}
                  searchQuery={sq || undefined}
                />
                {selectionPopover && (
                  <div
                    className="selection-popover"
                    style={{ top: selectionPopover.top, left: selectionPopover.left }}
                  >
                    <button
                      type="button"
                      className="selection-popover__btn"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const quoted = toBlockquote(selectionPopover.text);
                        if (composerOpen) {
                          // Append quote to existing draft
                          setComposerDraft((prev) => prev + quoted);
                        } else {
                          setComposerDraft(quoted);
                          setComposerOpen(true);
                        }
                        setComposerResetKey((k) => k + 1);
                        setSelectionPopover(null);
                        window.getSelection()?.removeAllRanges();
                        window.setTimeout(() => {
                          composerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                        }, 50);
                      }}
                    >
                      <MessageSquarePlus className="size-3.5" />
                      {composerOpen ? "+ Цитата" : "Обсудить"}
                    </button>
                  </div>
                )}
              </div>

              {/* Единый диалог-тред */}
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">Обсуждение</p>
                    <p className="text-sm leading-6 text-slate-600">
                      Расширения и доработки плана в виде диалога с AI-агентом.
                    </p>
                  </div>
                  {!composerOpen && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => setComposerOpen(true)}
                    >
                      Написать
                    </Button>
                  )}
                </div>

                {openQuestions.length > 0 ? (
                  <div className="mb-4 space-y-3">
                    {openQuestions.map((question) => (
                      <QuestionCard
                        key={question.id}
                        answerValue={questionAnswers[question.id] ?? ""}
                        isBusy={isBusy}
                        onChangeAnswer={(value) => {
                          setQuestionAnswers((current) => ({
                            ...current,
                            [question.id]: value
                          }));
                        }}
                        onSubmit={() => {
                          const answer = questionAnswers[question.id] ?? "";

                          if (!answer.trim()) {
                            return;
                          }

                          props.onAnswerPlanQuestion(props.detail.task.id, question.id, answer);
                          setQuestionAnswers((current) => ({
                            ...current,
                            [question.id]: ""
                          }));
                        }}
                        question={question}
                      />
                    ))}
                  </div>
                ) : null}

                {/* Тред сообщений */}
                <div className="space-y-5">
                  {threadItems.length === 0 && openQuestions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                      Обсуждений пока нет.
                    </div>
                  ) : (
                    threadItems.map((item) => {
                      if (item.type === "qa-pair") {
                        return (
                          <QAPairCard
                            key={item.question.id}
                            question={item.question}
                            searchQuery={sq || undefined}
                          />
                        );
                      }

                      const { comment, kind } = item;
                      return (
                        <article
                          key={comment.id}
                          className={`plan-thread-message ${
                            comment.author === "agent"
                              ? "plan-thread-message--agent"
                              : "plan-thread-message--human"
                          }`}
                        >
                          <div className="plan-thread-message__meta">
                            <div className="flex items-center gap-2">
                              <span className="plan-thread-message__author">
                                {comment.author === "agent" ? "AI агент" : "Вы"}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${KIND_BADGE_CLASSES[kind]}`}
                              >
                                {KIND_LABEL[kind]}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {kind === "extension" || kind === "improvement" ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  title="Скопировать prompt для AI агента"
                                  onClick={async () => {
                                    const copied = await copyText(
                                      buildPlanCommentPrompt(props.detail, kind, comment.id)
                                    );
                                    if (copied) {
                                      setCopiedCommentPromptId(comment.id);
                                    }
                                  }}
                                >
                                  <Copy className="size-4" />
                                </Button>
                              ) : null}
                              <span>
                                {copiedCommentPromptId === comment.id
                                  ? "prompt скопирован"
                                  : formatCommentDate(comment.createdAt)}
                              </span>
                            </div>
                          </div>
                          <div className="plan-thread-message__body">
                            <MarkdownPlanViewer
                              contentMd={comment.content}
                              searchQuery={sq || undefined}
                            />
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>

                {/* Кнопка «Написать» под тредом (когда composer закрыт) */}
                {!composerOpen && (
                  <div className="mt-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={isBusy}
                      onClick={() => setComposerOpen(true)}
                    >
                      Написать
                    </Button>
                  </div>
                )}

                {/* Composer */}
                {composerOpen ? (
                  <div ref={composerRef} className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    {/* Выбор типа */}
                    <div className="mb-3 flex gap-2">
                      {(["extension", "improvement"] as CommentKind[]).map((kind) => (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => setComposerKind(kind)}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                            composerKind === kind
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {KIND_LABEL[kind]}
                        </button>
                      ))}
                    </div>
                    <MilkdownEditor
                      className="app-input min-h-48"
                      value={composerDraft}
                      onChange={setComposerDraft}
                      resetKey={composerResetKey}
                      placeholder={
                        composerKind === "extension"
                          ? "Написать уточнение или идею по расширению плана..."
                          : "Написать изменение или доработку плана..."
                      }
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => setComposerOpen(false)}
                      >
                        Отмена
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!composerDraft.trim() || isBusy}
                        onClick={() => {
                          if (composerKind === "extension") {
                            props.onAppendPlanExtension(props.detail.task.id, composerDraft);
                          } else {
                            props.onAppendPlanImprovement(props.detail.task.id, composerDraft);
                          }
                          setComposerDraft("");
                          setComposerResetKey((k) => k + 1);
                          setComposerOpen(false);
                        }}
                      >
                        {props.isAppendingPlanExtension || props.isAppendingPlanImprovement
                          ? "Отправляем..."
                          : "Отправить"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </section>
            </div>
          ) : null
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            Плана еще нет. Сгенерируйте и сохраните его через внешний MCP-клиент или создайте Markdown вручную.
          </div>
        )}
      </div>
    </div>
  );
}

interface QuestionCardProps {
  answerValue: string;
  isBusy: boolean;
  onChangeAnswer(value: string): void;
  onSubmit(): void;
  question: PlanQuestionRecord;
}

function QuestionCard(props: QuestionCardProps) {
  return (
    <article className="rounded-2xl border border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,255,255,0.98))] p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Вопрос</p>
          <p className="text-sm leading-6 text-slate-800">{props.question.content}</p>
        </div>
        <span className="text-xs text-slate-500">{formatCommentDate(props.question.createdAt)}</span>
      </div>

      <textarea
        className="app-input mt-4 min-h-36"
        value={props.answerValue}
        onChange={(event) => props.onChangeAnswer(event.target.value)}
        placeholder="Напишите ответ, чтобы перевести вопрос в обсуждение..."
      />
      <div className="mt-3 flex justify-end">
        <Button type="button" variant="outline" disabled={!props.answerValue.trim() || props.isBusy} onClick={props.onSubmit}>
          {props.isBusy ? "Отправляем..." : "Ответить"}
        </Button>
      </div>
    </article>
  );
}

interface QAPairCardProps {
  question: PlanQuestionRecord;
  searchQuery?: string;
}

function QAPairCard({ question, searchQuery }: QAPairCardProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Вопрос AI — слева */}
      <div className="flex justify-start">
        <article className="plan-thread-message plan-thread-message--agent w-full max-w-[85%]">
          <div className="plan-thread-message__meta">
            <div className="flex items-center gap-2">
              <span className="plan-thread-message__author">AI агент</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${KIND_BADGE_CLASSES.discussion}`}>
                вопрос
              </span>
            </div>
            <span className="text-xs text-slate-400">{formatCommentDate(question.createdAt)}</span>
          </div>
          <div className="plan-thread-message__body">
            <MarkdownPlanViewer
              contentMd={question.content}
              searchQuery={searchQuery}
            />
          </div>
        </article>
      </div>
      {/* Ответ пользователя — справа (если есть) */}
      {question.answer ? (
        <div className="flex justify-end">
          <article className="plan-thread-message plan-thread-message--human w-full max-w-[85%]">
            <div className="plan-thread-message__meta">
              <div className="flex items-center gap-2">
                <span className="plan-thread-message__author">Вы</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${KIND_BADGE_CLASSES.discussion}`}>
                  ответ
                </span>
              </div>
              <span className="text-xs text-slate-400">{formatCommentDate(question.answeredAt)}</span>
            </div>
            <div className="plan-thread-message__body">
              <MarkdownPlanViewer
                contentMd={question.answer}
                searchQuery={searchQuery}
              />
            </div>
          </article>
        </div>
      ) : null}
    </div>
  );
}
