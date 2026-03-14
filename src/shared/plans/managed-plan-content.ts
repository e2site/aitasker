/*
Назначение: Управляет служебными блоками Markdown-плана для обсуждения, доработок и открытых вопросов поверх базового плана.
Не входит: Хранение планов в базе, создание ревизий и отрисовка интерфейса.
*/

const EXTENSIONS_MARKER_START = "aitasker:plan-extensions:start";
const EXTENSIONS_MARKER_END = "aitasker:plan-extensions:end";
const IMPROVEMENTS_MARKER_START = "aitasker:plan-improvements:start";
const IMPROVEMENTS_MARKER_END = "aitasker:plan-improvements:end";
const DISCUSSION_MARKER_START = "aitasker:plan-discussion:start";
const DISCUSSION_MARKER_END = "aitasker:plan-discussion:end";
const QUESTIONS_MARKER_START = "aitasker:plan-questions:start";
const QUESTIONS_MARKER_END = "aitasker:plan-questions:end";
const LEGACY_EXTENSIONS_MARKER_START = "<!-- aitasker:plan-extensions:start -->";
const LEGACY_EXTENSIONS_MARKER_END = "<!-- aitasker:plan-extensions:end -->";
const LEGACY_IMPROVEMENTS_MARKER_START = "<!-- aitasker:plan-improvements:start -->";
const LEGACY_IMPROVEMENTS_MARKER_END = "<!-- aitasker:plan-improvements:end -->";
const EXTENSIONS_TITLE = "Расширения плана";
const IMPROVEMENTS_TITLE = "Доработки";
const DISCUSSION_TITLE = "Обсуждение";
const QUESTIONS_TITLE = "Открытые вопросы";
const LEGACY_NOTES_TITLE = "Заметки";

export type ManagedPlanBlockKind = "discussion" | "extension" | "improvement";
export type ManagedPlanCommentAuthor = "human" | "agent";

export interface ManagedPlanComment {
  author: ManagedPlanCommentAuthor;
  content: string;
  createdAt: string | null;
  id: string;
}

export interface ManagedPlanQuestion {
  content: string;
  createdAt: string | null;
  id: string;
}

export interface ManagedPlanContent {
  baseContentMd: string;
  discussion: ManagedPlanComment[];
  extensions: ManagedPlanComment[];
  improvements: ManagedPlanComment[];
  questions: ManagedPlanQuestion[];
  renderedContentMd: string;
}

interface HiddenSectionConfig {
  endMarker: string;
  startMarker: string;
  title: string;
}

interface LegacyVisibleSectionConfig {
  endMarker: string;
  startMarker: string;
  title: string;
}

const hiddenSectionConfigByKind: Record<ManagedPlanBlockKind, HiddenSectionConfig> = {
  discussion: {
    endMarker: DISCUSSION_MARKER_END,
    startMarker: DISCUSSION_MARKER_START,
    title: DISCUSSION_TITLE
  },
  extension: {
    endMarker: EXTENSIONS_MARKER_END,
    startMarker: EXTENSIONS_MARKER_START,
    title: EXTENSIONS_TITLE
  },
  improvement: {
    endMarker: IMPROVEMENTS_MARKER_END,
    startMarker: IMPROVEMENTS_MARKER_START,
    title: IMPROVEMENTS_TITLE
  }
};

const legacyVisibleSectionConfigByKind: Record<"extension" | "improvement", LegacyVisibleSectionConfig> = {
  extension: {
    endMarker: LEGACY_EXTENSIONS_MARKER_END,
    startMarker: LEGACY_EXTENSIONS_MARKER_START,
    title: EXTENSIONS_TITLE
  },
  improvement: {
    endMarker: LEGACY_IMPROVEMENTS_MARKER_END,
    startMarker: LEGACY_IMPROVEMENTS_MARKER_START,
    title: IMPROVEMENTS_TITLE
  }
};

function normalizeMarkdown(text: string): string {
  return text.replace(/\r\n?/g, "\n").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createManagedEntityId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatManagedPlanComment(comment: Partial<ManagedPlanComment>): ManagedPlanComment {
  return {
    author: comment.author === "agent" ? "agent" : "human",
    content: normalizeMarkdown(comment.content ?? ""),
    createdAt: comment.createdAt?.trim() || null,
    id: comment.id?.trim() || createManagedEntityId("comment")
  };
}

function formatManagedPlanQuestion(question: Partial<ManagedPlanQuestion>): ManagedPlanQuestion {
  return {
    content: normalizeMarkdown(question.content ?? ""),
    createdAt: question.createdAt?.trim() || null,
    id: question.id?.trim() || createManagedEntityId("question")
  };
}

function parseLegacyItems(body: string): ManagedPlanComment[] {
  const normalizedBody = normalizeMarkdown(body);

  if (!normalizedBody) {
    return [];
  }

  const lines = normalizedBody.split("\n");
  const items: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (line.startsWith("- ")) {
      if (current.length > 0) {
        items.push(current.join("\n").trim());
      }

      current = [line.slice(2)];
      continue;
    }

    if (current.length === 0) {
      current = [line];
      continue;
    }

    current.push(line.startsWith("  ") ? line.slice(2) : line);
  }

  if (current.length > 0) {
    items.push(current.join("\n").trim());
  }

  return items
    .filter(Boolean)
    .map((content) =>
      formatManagedPlanComment({
        author: "human",
        content,
        createdAt: null
      })
    );
}

function formatHiddenSection<T extends ManagedPlanComment | ManagedPlanQuestion>(
  config: HiddenSectionConfig,
  values: T[]
): string {
  if (values.length === 0) {
    return "";
  }

  return `<!-- ${config.startMarker}\n${JSON.stringify(values, null, 2)}\n${config.endMarker} -->`;
}

function extractHiddenCommentSection(
  contentMd: string,
  config: HiddenSectionConfig
): { comments: ManagedPlanComment[]; contentMd: string } {
  const pattern = new RegExp(
    `<!-- ${escapeRegExp(config.startMarker)}\\s*\\n([\\s\\S]*?)\\n${escapeRegExp(config.endMarker)} -->`,
    "m"
  );
  const match = contentMd.match(pattern);

  if (!match) {
    return {
      comments: [],
      contentMd
    };
  }

  try {
    const parsed = JSON.parse(match[1] ?? "[]");
    const comments = Array.isArray(parsed)
      ? parsed.map((comment) => formatManagedPlanComment(comment)).filter((comment) => Boolean(comment.content))
      : [];

    return {
      comments,
      contentMd: normalizeMarkdown(contentMd.replace(match[0], ""))
    };
  } catch {
    return {
      comments: [],
      contentMd: normalizeMarkdown(contentMd.replace(match[0], ""))
    };
  }
}

function extractHiddenQuestionSection(
  contentMd: string
): { contentMd: string; questions: ManagedPlanQuestion[] } {
  const pattern = new RegExp(
    `<!-- ${escapeRegExp(QUESTIONS_MARKER_START)}\\s*\\n([\\s\\S]*?)\\n${escapeRegExp(QUESTIONS_MARKER_END)} -->`,
    "m"
  );
  const match = contentMd.match(pattern);

  if (!match) {
    return {
      contentMd,
      questions: []
    };
  }

  try {
    const parsed = JSON.parse(match[1] ?? "[]");
    const questions = Array.isArray(parsed)
      ? parsed.map((question) => formatManagedPlanQuestion(question)).filter((question) => Boolean(question.content))
      : [];

    return {
      contentMd: normalizeMarkdown(contentMd.replace(match[0], "")),
      questions
    };
  } catch {
    return {
      contentMd: normalizeMarkdown(contentMd.replace(match[0], "")),
      questions: []
    };
  }
}

function extractLegacyVisibleSection(
  contentMd: string,
  config: LegacyVisibleSectionConfig
): { comments: ManagedPlanComment[]; contentMd: string } {
  const pattern = new RegExp(
    `${escapeRegExp(config.startMarker)}\\s*\\n## ${escapeRegExp(config.title)}\\s*\\n([\\s\\S]*?)\\n${escapeRegExp(config.endMarker)}`,
    "m"
  );
  const match = contentMd.match(pattern);

  if (!match) {
    return {
      comments: [],
      contentMd
    };
  }

  return {
    comments: parseLegacyItems(match[1] ?? ""),
    contentMd: normalizeMarkdown(contentMd.replace(match[0], ""))
  };
}

function extractLegacyNotesSection(
  contentMd: string
): { comments: ManagedPlanComment[]; contentMd: string } {
  const pattern = new RegExp(`(?:^|\\n)## ${escapeRegExp(LEGACY_NOTES_TITLE)}\\s*\\n([\\s\\S]*)$`, "m");
  const match = contentMd.match(pattern);

  if (!match) {
    return {
      comments: [],
      contentMd
    };
  }

  return {
    comments: parseLegacyItems(match[1] ?? ""),
    contentMd: normalizeMarkdown(contentMd.slice(0, match.index).trim())
  };
}

function formatCommentTimestamp(createdAt: string | null): string {
  if (!createdAt) {
    return "без времени";
  }

  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "без времени";
  }

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  });
}

function getAuthorLabel(author: ManagedPlanCommentAuthor): string {
  return author === "agent" ? "AI агент" : "Пользователь";
}

function formatRenderedCommentSection(title: string, comments: ManagedPlanComment[]): string {
  if (comments.length === 0) {
    return "";
  }

  return [
    `## ${title}`,
    comments
      .map((comment) =>
        [`### ${getAuthorLabel(comment.author)} · ${formatCommentTimestamp(comment.createdAt)}`, comment.content].join(
          "\n\n"
        )
      )
      .join("\n\n")
  ].join("\n\n");
}

function formatRenderedQuestionSection(questions: ManagedPlanQuestion[]): string {
  if (questions.length === 0) {
    return "";
  }

  return [
    `## ${QUESTIONS_TITLE}`,
    questions.map((question) => `- ${question.content}`).join("\n")
  ].join("\n\n");
}

function stripRenderedDiscussionSections(contentMd: string): string {
  const normalizedContent = normalizeMarkdown(contentMd);
  const sectionsPattern = new RegExp(
    `(?:\\n|^)## ${escapeRegExp(EXTENSIONS_TITLE)}\\s*\\n[\\s\\S]*$|(?:\\n|^)## ${escapeRegExp(IMPROVEMENTS_TITLE)}\\s*\\n[\\s\\S]*$|(?:\\n|^)## ${escapeRegExp(DISCUSSION_TITLE)}\\s*\\n[\\s\\S]*$|(?:\\n|^)## ${escapeRegExp(QUESTIONS_TITLE)}\\s*\\n[\\s\\S]*$`,
    "m"
  );

  return normalizeMarkdown(normalizedContent.replace(sectionsPattern, ""));
}

export function composeManagedPlanContent(
  baseContentMd: string,
  extensions: ManagedPlanComment[],
  improvements: ManagedPlanComment[],
  discussion: ManagedPlanComment[],
  questions: ManagedPlanQuestion[]
): string {
  const parts = [
    normalizeMarkdown(baseContentMd),
    formatHiddenSection(hiddenSectionConfigByKind.extension, extensions),
    formatHiddenSection(hiddenSectionConfigByKind.improvement, improvements),
    formatHiddenSection(hiddenSectionConfigByKind.discussion, discussion),
    formatHiddenSection({ endMarker: QUESTIONS_MARKER_END, startMarker: QUESTIONS_MARKER_START, title: QUESTIONS_TITLE }, questions)
  ].filter(Boolean);

  return parts.join("\n\n").trim();
}

export function parseManagedPlanContent(contentMd: string): ManagedPlanContent {
  const normalizedContent = normalizeMarkdown(contentMd);
  const extractedExtensionsHidden = extractHiddenCommentSection(normalizedContent, hiddenSectionConfigByKind.extension);
  const extractedImprovementsHidden = extractHiddenCommentSection(
    extractedExtensionsHidden.contentMd,
    hiddenSectionConfigByKind.improvement
  );
  const extractedDiscussionHidden = extractHiddenCommentSection(
    extractedImprovementsHidden.contentMd,
    hiddenSectionConfigByKind.discussion
  );
  const extractedQuestionsHidden = extractHiddenQuestionSection(extractedDiscussionHidden.contentMd);
  const extractedExtensionsVisible = extractedExtensionsHidden.comments.length
    ? { comments: [] as ManagedPlanComment[], contentMd: extractedQuestionsHidden.contentMd }
    : extractLegacyVisibleSection(extractedQuestionsHidden.contentMd, legacyVisibleSectionConfigByKind.extension);
  const extractedImprovementsVisible = extractedImprovementsHidden.comments.length
    ? { comments: [] as ManagedPlanComment[], contentMd: extractedExtensionsVisible.contentMd }
    : extractLegacyVisibleSection(extractedExtensionsVisible.contentMd, legacyVisibleSectionConfigByKind.improvement);
  const legacyNotes = extractedExtensionsHidden.comments.length || extractedExtensionsVisible.comments.length
    ? { comments: [] as ManagedPlanComment[], contentMd: extractedImprovementsVisible.contentMd }
    : extractLegacyNotesSection(extractedImprovementsVisible.contentMd);
  const baseContentMd = normalizeMarkdown(legacyNotes.contentMd);
  const extensions = [
    ...extractedExtensionsHidden.comments,
    ...extractedExtensionsVisible.comments,
    ...legacyNotes.comments
  ];
  const improvements = [...extractedImprovementsHidden.comments, ...extractedImprovementsVisible.comments];
  const discussion = extractedDiscussionHidden.comments;
  const questions = extractedQuestionsHidden.questions;

  return {
    baseContentMd,
    discussion,
    extensions,
    improvements,
    questions,
    renderedContentMd: [
      baseContentMd,
      formatRenderedCommentSection(EXTENSIONS_TITLE, extensions),
      formatRenderedCommentSection(IMPROVEMENTS_TITLE, improvements),
      formatRenderedCommentSection(DISCUSSION_TITLE, discussion),
      formatRenderedQuestionSection(questions)
    ]
      .filter(Boolean)
      .join("\n\n")
      .trim()
  };
}

export function appendManagedPlanBlock(
  contentMd: string,
  kind: ManagedPlanBlockKind,
  value: string,
  author: ManagedPlanCommentAuthor
): string {
  const parsed = parseManagedPlanContent(contentMd);
  const normalizedValue = normalizeMarkdown(value);

  if (!normalizedValue) {
    return composeManagedPlanContent(
      parsed.baseContentMd,
      parsed.extensions,
      parsed.improvements,
      parsed.discussion,
      parsed.questions
    );
  }

  const nextComment = formatManagedPlanComment({
    author,
    content: normalizedValue,
    createdAt: new Date().toISOString()
  });

  return composeManagedPlanContent(
    parsed.baseContentMd,
    kind === "extension" ? [...parsed.extensions, nextComment] : parsed.extensions,
    kind === "improvement" ? [...parsed.improvements, nextComment] : parsed.improvements,
    kind === "discussion" ? [...parsed.discussion, nextComment] : parsed.discussion,
    parsed.questions
  );
}

export function replaceBasePlanContent(contentMd: string, nextBaseContentMd: string): string {
  const parsed = parseManagedPlanContent(contentMd);

  return composeManagedPlanContent(
    nextBaseContentMd,
    parsed.extensions,
    parsed.improvements,
    parsed.discussion,
    parsed.questions
  );
}

export function replaceManagedPlanQuestions(contentMd: string, nextQuestions: string[]): string {
  const parsed = parseManagedPlanContent(contentMd);
  const questions = nextQuestions
    .map((question) =>
      formatManagedPlanQuestion({
        content: question,
        createdAt: new Date().toISOString()
      })
    )
    .filter((question) => Boolean(question.content));

  return composeManagedPlanContent(
    parsed.baseContentMd,
    parsed.extensions,
    parsed.improvements,
    parsed.discussion,
    questions
  );
}

export function answerManagedPlanQuestion(contentMd: string, questionId: string, answer: string): string {
  const parsed = parseManagedPlanContent(contentMd);
  const question = parsed.questions.find((item) => item.id === questionId);
  const normalizedAnswer = normalizeMarkdown(answer);

  if (!question || !normalizedAnswer) {
    return composeManagedPlanContent(
      parsed.baseContentMd,
      parsed.extensions,
      parsed.improvements,
      parsed.discussion,
      parsed.questions
    );
  }

  return composeManagedPlanContent(
    parsed.baseContentMd,
    parsed.extensions,
    parsed.improvements,
    [
      ...parsed.discussion,
      formatManagedPlanComment({
        author: "agent",
        content: `**Вопрос:** ${question.content}`,
        createdAt: question.createdAt
      }),
      formatManagedPlanComment({
        author: "human",
        content: `**Ответ:** ${normalizedAnswer}`,
        createdAt: new Date().toISOString()
      })
    ],
    parsed.questions.filter((item) => item.id !== questionId)
  );
}

export function consolidateManagedPlanDiscussion(
  contentMd: string,
  nextBaseContentMd: string,
  nextQuestions?: string[]
): string {
  const parsed = parseManagedPlanContent(contentMd);
  const questions =
    nextQuestions === undefined
      ? parsed.questions
      : nextQuestions
          .map((question) =>
            formatManagedPlanQuestion({
              content: question,
              createdAt: new Date().toISOString()
            })
          )
          .filter((question) => Boolean(question.content));

  return composeManagedPlanContent(nextBaseContentMd, [], [], [], questions);
}

export function extractBasePlanContent(contentMd: string): string {
  const parsed = parseManagedPlanContent(contentMd);

  return stripRenderedDiscussionSections(parsed.baseContentMd);
}

export function findManagedPlanComment(
  contentMd: string,
  kind: ManagedPlanBlockKind,
  commentId: string
): ManagedPlanComment | null {
  const parsed = parseManagedPlanContent(contentMd);
  const comments =
    kind === "extension"
      ? parsed.extensions
      : kind === "improvement"
        ? parsed.improvements
        : parsed.discussion;

  return comments.find((comment) => comment.id === commentId) ?? null;
}

export function findManagedPlanQuestion(contentMd: string, questionId: string): ManagedPlanQuestion | null {
  const parsed = parseManagedPlanContent(contentMd);

  return parsed.questions.find((question) => question.id === questionId) ?? null;
}
