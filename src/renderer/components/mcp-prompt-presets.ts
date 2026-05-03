/*
Назначение: Хранит и собирает все текстовые MCP-промты проекта: пресеты для UI, серверные prompt-сообщения и короткие команды для копирования.
Не входит: Отрисовка UI-кнопок, копирование в буфер и состояние feedback после копирования.
*/
import type { ProjectRecord, PromptOverrideRecord, ResourceRecord, TaskDetail } from "@/shared/contracts/desktop-api";
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
  | "reload-context"
  | "project-skill"
  | "search-hints"
  | "save-hints";

export interface ProjectPromptContext {
  id: string;
  name: string;
  rootPath: string | null;
  skillFilePath: string | null;
}

export interface RegisteredPromptMessageArgs {
  instructions?: string;
  projectRef: string;
  taskRef?: string;
  skillPath?: string;
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

export function buildProjectActivationCopyPrompt(project: Pick<ProjectRecord, "id" | "name" | "rootPath" | "description" | "languages">): string {
  return [
    `Активируй проект "${project.name}" (ID: ${project.id}).`,
    `Путь: ${project.rootPath ?? "не указан"}.`,
    `Описание: ${project.description || "нет"}.`,
    `Языки: ${project.languages.join(", ") || "нет"}.`,
    "Заполни карточку проекта через update_project_profile если поля не заполнены."
  ].join("\n");
}

export function buildResourceReadCopyPrompt(resource: Pick<ResourceRecord, "id" | "name">): string {
  return `Прочитай ресурс "${resource.name}" — вызови get_resource с id "${resource.id}"`;
}

export function buildRegisteredPromptMessage(
  promptId: "plan_task" | "compress_plan_discussion" | "create_project_skill",
  args: RegisteredPromptMessageArgs
): string {
  if (promptId === "plan_task") {
    return `Выполни планирование задачи в AITasker через MCP aitasker.

Проект: ${args.projectRef}
Задача: ${args.taskRef ?? ""}

Шаги:
1. Активируй проект через activate_project.
2. Найди задачу и получи её данные через sync_task — это переведёт сессию в work-режим.
3. Прочитай linkedResources через get_resource если они влияют на задачу.
4. Если есть открытые вопросы (plan.questions) — ответь через answer_plan_question или оставь нерешённые в openQuestions при сохранении.
5. Составь план и сохрани через save_plan, передав openQuestions отдельным массивом.
6. Переведи статус задачи в planning, затем в implementation через update_task_status.

${args.instructions?.trim() ? `Доп. инструкции: ${args.instructions.trim()}` : ""}

Не останавливайся на анализе. Сохрани результат в AITasker до финального ответа.`;
  }

  if (promptId === "compress_plan_discussion") {
    return `Сожми обсуждение задачи в обновлённый план в AITasker через MCP aitasker.

Проект: ${args.projectRef}
Задача: ${args.taskRef ?? ""}

Шаги:
1. Активируй проект через activate_project.
2. Получи данные задачи через sync_task.
3. Прочитай все комментарии (plan.comments) и открытые вопросы (plan.questions).
4. Прочитай linkedResources через get_resource если нужны для понимания.
5. Если на вопросы есть ответы — сохрани через answer_plan_question.
6. Собери обновлённый план из базового плана + комментарии + решённые вопросы.
7. Сохрани через consolidate_plan_discussion, нерешённые вопросы передай в openQuestions.

${args.instructions?.trim() ? `Доп. инструкции: ${args.instructions.trim()}` : ""}

Не останавливайся на анализе. Обязательно сохрани обновлённый план до финального ответа.`;
  }

  return `Подготовь или обнови SKILL.md проекта в AITasker через MCP aitasker.

Проект: ${args.projectRef}
${args.skillPath?.trim() ? `Путь к SKILL.md: ${args.skillPath.trim()}` : ""}

Шаги:
1. Активируй проект через activate_project и прочитай карточку.
2. Определи путь к SKILL.md из skillFilePath проекта или используй <rootPath>/SKILL.md.
3. Создай или обнови файл SKILL.md с описанием стека, конвенций и особенностей проекта.
4. Сохрани путь к файлу через update_project_profile.

${args.instructions?.trim() ? `Доп. инструкции: ${args.instructions.trim()}` : ""}

Если путь нельзя определить надёжно, остановись и запроси его у пользователя.`;
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
    `Активируй проект "{{projectName}}" (ID: {{projectId}}) через activate_project.
Проверь карточку проекта через get_active_project. Если поля не заполнены — заполни через update_project_profile.`,

"agent-task-prompt":
  `Создай задачу в проекте {{projectName}} (ID: {{projectId}}) через MCP aitasker.
Вызови activate_project, затем create_task с title и description.
После создания сохрани план через save_plan, обязательно передав:
- contentMd
- goal
- criticalConditions
- forbiddenInterpretations
- acceptanceCriteria
Переведи статус в planning.

Задача:`,

 "plan-task":
  `Выполни планирование задачи "{{taskTitle}}" (ID: {{taskId}}) в проекте {{projectName}}.

Шаги:
1. Вызови sync_task с taskId {{taskId}}.
2. Прочитай linkedResources через get_resource, если они влияют на задачу.
3. Если есть открытые вопросы (plan.questions) — ответь через answer_plan_question или оставь в openQuestions.
4. Составь план и обязательно заполни: goal, criticalConditions, forbiddenInterpretations, acceptanceCriteria.
5. Сохрани всё через save_plan.
6. Переведи статус в planning, затем implementation через update_task_status.`,

 "clarify-plan":
  `Уточни план задачи "{{taskTitle}}" (ID: {{taskId}}) в проекте {{projectName}}.

Шаги:
1. Вызови sync_task с taskId {{taskId}}.
2. Прочитай plan.comments и plan.questions.
3. Прочитай linkedResources через get_resource, если нужны.
4. Ответь на открытые вопросы через answer_plan_question или оставь их в openQuestions.
5. Обнови и сохрани план через save_plan:
   - contentMd
   - goal
   - criticalConditions
   - forbiddenInterpretations
   - acceptanceCriteria
   - openQuestions
6. Убедись, что criticalConditions не потеряны.`,

  "implementation":
  `Реализуй задачу "{{taskTitle}}" (ID: {{taskId}}) в проекте {{projectName}} по шагам плана.

Шаги:
1. Вызови sync_task с taskId {{taskId}}.
2. Прочитай plan.comments, criticalConditions и linkedResources через get_resource.
3. Реализуй задачу по шагам плана с учётом criticalConditions.
4. Контекстные заметки добавляй через append_plan_extension.
5. Решения и проблемы фиксируй через append_plan_improvement.
6. Проверь все ли goal выполнены, не нарушены forbiddenInterpretations и соответствует acceptanceCriteria
7. После завершения переведи статус в testing через update_task_status.`,

  "finish-task":
    `Заверши задачу "{{taskTitle}}" (ID: {{taskId}}) в проекте {{projectName}}.

Шаги:
1. Вызови sync_task с taskId {{taskId}}.
2. Убедись, что все шаги плана выполнены.
3. При необходимости добавь финальные заметки через append_plan_extension.
4. Переведи статус в completed через update_task_status.`,

  "consolidate-discussion":
  `Сожми обсуждение задачи "{{taskTitle}}" (ID: {{taskId}}) в обновлённый план.

Шаги:
1. Вызови sync_task с taskId {{taskId}}.
2. Прочитай все plan.comments и plan.questions.
3. Ответь на решённые вопросы через answer_plan_question.
4. Собери новый план из базового плана и комментариев.
5. Сохрани через consolidate_plan_discussion:
   - contentMd
   - goal
   - criticalConditions
   - forbiddenInterpretations
   - acceptanceCriteria
   - openQuestions
6. Убедись, что criticalConditions не потеряны.`,

  "reload-context":
    `Перезагрузи контекст задачи "{{taskTitle}}" (ID: {{taskId}}) — контекст мог сжаться.

Вызови get_task с taskId {{taskId}} для получения полного снапшота задачи:
план, комментарии, вопросы, связанные задачи и ресурсы.

После загрузки прочитай linkedResources через get_resource если они нужны для продолжения работы.`,

  "project-skill":
    `Создай или обнови SKILL.md для проекта {{projectName}} (ID: {{projectId}}).

Шаги:
1. Прочитай карточку проекта через get_active_project.
2. Путь к файлу: {{skillFilePath}}.
3. Создай или обнови SKILL.md с описанием стека, конвенций и особенностей проекта.
4. Сохрани путь через update_project_profile.`,

  "search-hints":
    `Активируй проект (ID: {{projectId}}) через activate_project.
Перед работой над задачей "{{taskTitle}}" поищи подсказки проекта.
Вызови search_project_hints с ключевыми словами по теме задачи.
Если релевантного нет — игнорируй и продолжай по плану.`,

  "save-hints":
    `Активируй проект (ID: {{projectId}}) через activate_project.
Сохрани важные инсайты по итогам задачи "{{taskTitle}}" через add_project_hints.
Только то, что пригодится в будущих задачах: грабли, скрытые зависимости, нюансы окружения.
Очевидное и общее не добавляй. Если важного нет — пропусти.`
};

const PROMPT_META: Record<PromptId, { title: string; description: string }> = {
  "activate-project": {
    title: "Активация проекта",
    description: "Активировать проект и проверить карточку."
  },
  "agent-task-prompt": {
    title: "Создать задачу",
    description: "Создать задачу и сразу сохранить план."
  },
  "plan-task": {
    title: "Планирование задачи",
    description: "Составить и сохранить план задачи."
  },
  "clarify-plan": {
    title: "Уточнение плана",
    description: "Перечитать план и уточнить его с учётом обсуждения."
  },
  "implementation": {
    title: "Реализация",
    description: "Реализовать задачу по шагам плана."
  },
  "finish-task": {
    title: "Завершение задачи",
    description: "Финальная проверка и перевод задачи в completed."
  },
  "consolidate-discussion": {
    title: "Сжать переписку в план",
    description: "Собрать новый план из расширений и доработок."
  },
  "reload-context": {
    title: "Перезагрузить контекст",
    description: "Полная загрузка данных задачи через get_task — когда контекст сжался."
  },
  "project-skill": {
    title: "Создание SKILL.md",
    description: "Обновить SKILL.md и карточку проекта."
  },
  "search-hints": {
    title: "Поиск подсказок",
    description: "Найти релевантные инсайты проекта по теме задачи."
  },
  "save-hints": {
    title: "Сохранить инсайты",
    description: "Записать важные находки по итогам задачи."
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

// Промты где агент впервые берёт задачу — нужна полная подсказка о ресурсах
const PROMPTS_WITH_FULL_CONTEXT = new Set<PromptId>([
  "plan-task", "reload-context"
]);

// Промты где агент продолжает работу через sync_task — только связанные задачи, без инструкции по ресурсам
const PROMPTS_WITH_LINKED_TASKS = new Set<PromptId>([
  "clarify-plan", "implementation", "finish-task", "consolidate-discussion"
]);

/** Полный суффикс: ресурсы с инструкцией + связанные задачи. Для первого чтения задачи. */
function buildFullContextSuffix(detail: TaskDetail): string {
  const lines: string[] = [];

  for (const r of detail.linkedResources) {
    lines.push(`Ресурс: "${r.name}" (id: ${r.resourceId}) — прочитай через get_resource("${r.resourceId}")`);
  }

  for (const t of detail.linkedTasks) {
    lines.push(`Связанная задача: "${t.title}" (id: ${t.taskId})`);
  }

  if (lines.length === 0) return "";

  const resourceInstruction =
    detail.linkedResources.length > 0
      ? "\nЕсли ресурсы влияют на задачу — обязательно прочитай их через get_resource до ответа."
      : "";

  return "\n\nСвязанные объекты:\n" + lines.join("\n") + resourceInstruction;
}

/** Краткий суффикс: только связанные задачи, без инструкции по ресурсам. Для продолжения работы через sync_task. */
function buildLinkedTasksSuffix(detail: TaskDetail): string {
  if (detail.linkedTasks.length === 0) return "";

  const lines = detail.linkedTasks.map(
    (t) => `Связанная задача: "${t.title}" (id: ${t.taskId})`
  );

  return "\n\nСвязанные задачи:\n" + lines.join("\n");
}

export function buildPlanCommentPrompt(detail: TaskDetail, kind: "extension" | "improvement", commentId: string): string {
  const kindLabel = kind === "extension" ? "расширение" : "доработку";
  const kindArg = kind === "extension" ? `extensionId: "${commentId}"` : `improvementId: "${commentId}"`;

  return `Проработай ${kindLabel} плана задачи "${detail.task.title}" (ID: ${detail.task.id}).

1. Вызови sync_task с taskId ${detail.task.id} для получения актуального контекста.
2. Найди ${kindLabel} с ${kindArg} в plan.comments.
3. Проанализируй и при необходимости обнови план через save_plan или consolidate_plan_discussion.`;
}

export function buildMcpPromptPresets(
  detail: TaskDetail,
  overrides: PromptOverrideRecord[] = []
): McpPromptPreset[] {
  const vars = getPromptVars(detail);
  const fullSuffix = buildFullContextSuffix(detail);
  const linkedSuffix = buildLinkedTasksSuffix(detail);

  return (Object.keys(BASE_PROMPT_TEMPLATES) as PromptId[]).map((id) => {
    let suffix = "";
    if (PROMPTS_WITH_FULL_CONTEXT.has(id)) suffix = fullSuffix;
    else if (PROMPTS_WITH_LINKED_TASKS.has(id)) suffix = linkedSuffix;

    return {
      id,
      title: PROMPT_META[id].title,
      description: PROMPT_META[id].description,
      prompt: resolvePrompt(id, vars, overrides) + suffix
    };
  });
}
