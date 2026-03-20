/*
Назначение: Хранит и собирает единый набор коротких MCP-команд для проекта, задачи и точечных операций по плану.
Не входит: Отрисовка UI-кнопок, копирование в буфер и состояние feedback после копирования.
*/
import type { ProjectRecord, PromptOverrideRecord, TaskDetail } from "@/shared/contracts/desktop-api";
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

export interface ProjectPromptContext {
  id: string;
  name: string;
  rootPath: string | null;
  skillFilePath: string | null;
}

function buildProjectPromptVars(context: ProjectPromptContext): PromptVariable[] {
  const projectPath = context.rootPath ?? "<укажи путь проекта>";
  const skillFilePath = context.skillFilePath ?? `${projectPath}\\SKILL.md`;

  return [
    { name: "projectId", value: context.id, placeholder: "project-id" },
    { name: "projectName", value: context.name, placeholder: "«Название проекта»" },
    { name: "taskTitle", value: "", placeholder: "«Название задачи»" },
    { name: "taskId", value: "", placeholder: "«ID задачи»" },
    { name: "projectPath", value: projectPath, placeholder: "«Путь к проекту»" },
    { name: "skillFilePath", value: skillFilePath, placeholder: "«Путь к SKILL.md»" }
  ];
}

/** Возвращает переменные промта для конкретной задачи. */
export function getPromptVars(detail: TaskDetail): PromptVariable[] {
  return buildProjectPromptVars({
    id: detail.task.projectId,
    name: detail.task.projectName,
    rootPath: detail.project.rootPath,
    skillFilePath: detail.project.skillFilePath
  }).map((variable) => {
    if (variable.name === "taskTitle") {
      return { ...variable, value: detail.task.title };
    }

    if (variable.name === "taskId") {
      return { ...variable, value: detail.task.id };
    }

    return variable;
  });
}

/** Возвращает переменные промта для операций на уровне проекта без выбранной задачи. */
export function getProjectPromptVars(project: Pick<ProjectRecord, "id" | "name" | "rootPath" | "skillFilePath">): PromptVariable[] {
  return buildProjectPromptVars({
    id: project.id,
    name: project.name,
    rootPath: project.rootPath,
    skillFilePath: project.skillFilePath
  });
}

/** Базовые шаблоны промтов. */
export const BASE_PROMPT_TEMPLATES: Record<PromptId, string> = {
  "activate-project":
    `{
  "mcp": "aitasker",
  "projectId": "{{projectId}}",
  "action": "activate_project_profile",
  "read": ["get_active_project"],
  "write": ["update_project_profile"],
  "rules": ["ensure_project_profile_complete"]
}`,
  "agent-task-prompt":
    `{
  "mcp": "aitasker",
  "projectId": "{{projectId}}",
  "action": "create_task",
  "fillRequired": ["title", "description"],
  "nextStatus": "planning",
  "rules": ["create_task_in_project", "save_plan_after_creation"]
}
Задача:`,
  "plan-task":
    `{
  "mcp": "aitasker",
  "projectId": "{{projectId}}",
  "action": "plan_task",
  "taskId": "{{taskId}}",
  "read": ["get_task", "get_plan"],
  "write": ["save_plan", "update_task_status"],
  "statusFlow": ["planning", "implementation"],
  "rules": ["read_current_plan_if_exists", "save_open_questions_separately"]
}`,
  "clarify-plan":
    `{
  "mcp": "aitasker",
  "projectId": "{{projectId}}",
  "action": "clarify_plan",
  "taskId": "{{taskId}}",
  "read": ["get_task", "get_plan"],
  "write": ["save_plan"],
  "rules": ["review_current_plan", "add_missing_steps", "save_open_questions_separately"]
}`,
  "implementation":
    `{
  "mcp": "aitasker",
  "projectId": "{{projectId}}",
  "action": "implement_task",
  "taskId": "{{taskId}}",
  "read": ["get_task", "get_plan"],
  "write": ["append_plan_extension", "append_plan_improvement", "update_task_status"],
  "status": "implementation",
  "rules": [
    "check_plan_before_work",
    "implement_by_plan_steps",
    "append_context_via_extension",
    "append_decisions_and_issues_via_improvement",
    "keep_status_implementation"
  ]
}`,
  "finish-task":
    `{
  "mcp": "aitasker",
  "projectId": "{{projectId}}",
  "action": "complete_task",
  "taskId": "{{taskId}}",
  "read": ["get_task", "get_plan"],
  "write": ["append_plan_extension", "append_plan_improvement", "update_task_status"],
  "status": "completed",
  "rules": ["verify_plan_done", "record_final_notes_if_needed"]
}`,
  "consolidate-discussion":
    `{
  "mcp": "aitasker",
  "projectId": "{{projectId}}",
  "action": "consolidate_plan_discussion",
  "taskId": "{{taskId}}",
  "read": ["get_task", "get_plan"],
  "write": ["consolidate_plan_discussion"],
  "rules": ["merge_extensions_and_improvements_into_plan", "save_open_questions_separately"]
}`,
  "project-skill":
    `{
  "mcp": "aitasker",
  "projectId": "{{projectId}}",
  "action": "sync_project_skill",
  "skillFilePath": "{{skillFilePath}}",
  "read": ["get_active_project"],
  "write": ["update_project_profile"],
  "rules": ["create_or_update_skill_file", "sync_skill_path_to_project_profile"]
}`
};

const PROMPT_META: Record<PromptId, { title: string; description: string }> = {
  "activate-project": {
    title: "Активация проекта",
    description: "Активировать проект и проверить карточку без длинного текстового сценария."
  },
  "agent-task-prompt": {
    title: "Создать задачу в агенте",
    description: "Короткая команда для создания задачи, когда title и description будут переданы отдельно."
  },
  "plan-task": {
    title: "Планирование задачи",
    description: "Короткая команда для перевода задачи в planning и сохранения плана."
  },
  "clarify-plan": {
    title: "Уточнение плана",
    description: "Короткая команда для перечитывания плана и его уточнения."
  },
  "implementation": {
    title: "Переход к реализации",
    description: "Короткая команда для реализации по шагам плана."
  },
  "finish-task": {
    title: "Завершение задачи",
    description: "Короткая команда для финальной проверки и перевода задачи в completed."
  },
  "consolidate-discussion": {
    title: "Сжать переписку в план",
    description: "Короткая команда для сборки нового плана из расширений и доработок."
  },
  "project-skill": {
    title: "Создание SKILL.md",
    description: "Короткая команда для обновления SKILL.md и карточки проекта."
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
    lines.push(`resource:${r.resourceId} "${r.name}"`);
  }

  for (const t of detail.linkedTasks) {
    lines.push(`task:${t.taskId} "${t.title}"`);
  }

  if (lines.length === 0) return "";

  return "\n\nКонтекст:\n" + lines.join("\n");
}

export function buildPlanCommentPrompt(detail: TaskDetail, kind: "extension" | "improvement", commentId: string): string {
  if (kind === "extension") {
    return `{
  "mcp": "aitasker",
  "projectId": "${detail.task.projectId}",
  "action": "review_plan_extension",
  "taskId": "${detail.task.id}",
  "extensionId": "${commentId}"
}`;
  }

  return `{
  "mcp": "aitasker",
  "projectId": "${detail.task.projectId}",
  "action": "review_plan_improvement",
  "taskId": "${detail.task.id}",
  "improvementId": "${commentId}"
}`;
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
