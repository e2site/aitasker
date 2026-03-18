/*
Назначение: Хранит готовые MCP-промты для задачи, чтобы их можно было переиспользовать в workflow-экране и быстрых кнопках.
Не входит: Отрисовка UI-кнопок, копирование в буфер и состояние feedback после копирования.
*/
import type { PromptOverrideRecord, TaskDetail } from "@/shared/contracts/desktop-api";
import type { PromptVariable } from "@/shared/prompts/prompt-template";
import { renderPromptTemplate } from "@/shared/prompts/prompt-template";

export interface McpPromptPreset {
  description: string;
  id: string;
  prompt: string;
  title: string;
}

export type PromptId =
  | "activate-project"
  | "agent-task-prompt"
  | "plan-task"
  | "clarify-plan"
  | "implementation"
  | "finish-task"
  | "consolidate-discussion"
  | "project-skill";

/** Возвращает переменные промта для конкретной задачи. */
export function getPromptVars(detail: TaskDetail): PromptVariable[] {
  const projectName = detail.task.projectName;
  const taskTitle = detail.task.title;
  const taskId = detail.task.id;
  const projectPath = detail.project.rootPath ?? "<укажи путь проекта>";
  const skillFilePath = detail.project.skillFilePath ?? `${projectPath}\\SKILL.md`;

  return [
    { name: "projectName", value: projectName, placeholder: "«Название проекта»" },
    { name: "taskTitle", value: taskTitle, placeholder: "«Название задачи»" },
    { name: "taskId", value: taskId, placeholder: "«ID задачи»" },
    { name: "projectPath", value: projectPath, placeholder: "«Путь к проекту»" },
    { name: "skillFilePath", value: skillFilePath, placeholder: "«Путь к SKILL.md»" }
  ];
}

/** Базовые шаблоны промтов. */
export const BASE_PROMPT_TEMPLATES: Record<PromptId, string> = {
  "activate-project":
    `Активируй в aitasker проект "{{projectName}}". Проверь карточку проекта и, если нужно, заполни название, описание, путь "{{projectPath}}" и используемые языки. Кратко отчитайся, что именно было обновлено.`,
  "agent-task-prompt":
    `Активируй в aitasker проект "{{projectName}}". Распланируй задачу, сохрани план через MCP и переведи задачу в статус planning. Выполнять сразу не надо. Задача: `,
  "plan-task":
    `Активируй в aitasker проект "{{projectName}}", найди задачу "{{taskTitle}}" ({{taskId}}), переведи ее в статус planning, распланируй задачу, сохрани план обратно через MCP и затем переведи задачу в статус implementation.`,
  "clarify-plan":
    `Активируй в aitasker проект "{{projectName}}", открой задачу "{{taskTitle}}" ({{taskId}}), перечитай текущий план, уточни его, добавь недостающие шаги и открытые вопросы, затем сохрани обновленный план обратно через MCP.`,
  "implementation":
    `Активируй в aitasker проект "{{projectName}}", открой задачу "{{taskTitle}}" ({{taskId}}), проверь план, приступай к реализации по шагам плана и добавляй расширения через append_plan_extension, а отдельные доработки через append_plan_improvement. Статус задачи держи implementation.`,
  "finish-task":
    `Активируй в aitasker проект "{{projectName}}", открой задачу "{{taskTitle}}" ({{taskId}}), проверь что план выполнен, при необходимости добавь финальное расширение или доработку плана и переведи задачу в статус completed.`,
  "consolidate-discussion":
    `Активируй в aitasker проект "{{projectName}}", открой задачу "{{taskTitle}}" ({{taskId}}), перечитай текущий план, расширения и доработки, затем собери новый цельный Markdown-план и вызови consolidate_plan_discussion, чтобы очистить отдельные блоки переписки.`,
  "project-skill":
    `Активируй в aitasker проект "{{projectName}}", проверь карточку проекта, затем создай или обнови SKILL.md в "{{skillFilePath}}". После записи сохрани путь к skill-файлу в карточке проекта и кратко опиши, что вошло в SKILL.md.`
};

const PROMPT_META: Record<PromptId, { title: string; description: string }> = {
  "activate-project": {
    title: "Активация проекта",
    description: "Заполнить карточку проекта до начала работы с задачами."
  },
  "agent-task-prompt": {
    title: "Создать задачу в агенте",
    description: "Промт для создания и планирования новой задачи через агента."
  },
  "plan-task": {
    title: "Планирование задачи",
    description: "Базовый стартовый сценарий для создания или обновления плана."
  },
  "clarify-plan": {
    title: "Уточнение плана",
    description: "Пересмотреть текущий план и добавить открытые вопросы или недостающие шаги."
  },
  "implementation": {
    title: "Переход к реализации",
    description: "Использовать готовый план как вход для следующего этапа работы."
  },
  "finish-task": {
    title: "Завершение задачи",
    description: "Закрыть задачу, синхронизировать статус и финальные расширения или доработки."
  },
  "consolidate-discussion": {
    title: "Сжать переписку в план",
    description: "Собрать переписку по расширениям и доработкам обратно в единый план и очистить диалог."
  },
  "project-skill": {
    title: "Создание SKILL.md",
    description: "Подготовить или обновить skill-файл проекта."
  }
};

/**
 * Разрешает итоговый промт: если есть переопределение — рендерит его шаблон,
 * иначе рендерит базовый шаблон.
 */
export function resolvePrompt(
  promptId: PromptId,
  vars: PromptVariable[],
  overrides: PromptOverrideRecord[]
): string {
  const override = overrides.find((o) => o.id === promptId);
  const template = override?.template ?? BASE_PROMPT_TEMPLATES[promptId];
  return renderPromptTemplate(template, vars);
}

const PROMPTS_WITH_CONTEXT = new Set<PromptId>([
  "plan-task", "clarify-plan", "implementation", "finish-task", "consolidate-discussion"
]);

function buildContextSuffix(detail: TaskDetail): string {
  const lines: string[] = [];

  for (const r of detail.linkedResources) {
    lines.push(`- Ресурс "${r.name}": выполни get_resource с id "${r.resourceId}"`);
  }

  for (const t of detail.linkedTasks) {
    lines.push(`- Связанная задача "${t.title}" (${t.taskId}): выполни get_task с taskId "${t.taskId}"`);
  }

  if (lines.length === 0) return "";

  return "\n\nКонтекст задачи:\n" + lines.join("\n");
}

export function buildMcpPromptPresets(
  detail: TaskDetail,
  overrides: PromptOverrideRecord[] = []
): McpPromptPreset[] {
  const vars = getPromptVars(detail);
  const suffix = buildContextSuffix(detail);

  return (Object.keys(BASE_PROMPT_TEMPLATES) as PromptId[]).map((id) => ({
    id,
    title: PROMPT_META[id].title,
    description: PROMPT_META[id].description,
    prompt: resolvePrompt(id, vars, overrides) + (PROMPTS_WITH_CONTEXT.has(id) ? suffix : "")
  }));
}
