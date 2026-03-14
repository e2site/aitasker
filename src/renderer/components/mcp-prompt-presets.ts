/*
Назначение: Хранит готовые MCP-промты для задачи, чтобы их можно было переиспользовать в workflow-экране и быстрых кнопках.
Не входит: Отрисовка UI-кнопок, копирование в буфер и состояние feedback после копирования.
*/
import type { TaskDetail } from "@/shared/contracts/desktop-api";

export interface McpPromptPreset {
  description: string;
  id: string;
  prompt: string;
  title: string;
}

export function buildMcpPromptPresets(detail: TaskDetail): McpPromptPreset[] {
  const projectName = detail.task.projectName;
  const taskTitle = detail.task.title;
  const taskId = detail.task.id;
  const projectPath = detail.project.rootPath ?? "<укажи путь проекта>";

  return [
    {
      id: "activate-project",
      title: "Активация проекта",
      description: "Заполнить карточку проекта до начала работы с задачами.",
      prompt: `Активируй в aitasker проект "${projectName}". Проверь карточку проекта и, если нужно, заполни название, описание, путь "${projectPath}" и используемые языки. Кратко отчитайся, что именно было обновлено.`
    },
    {
      id: "plan-task",
      title: "Планирование задачи",
      description: "Базовый стартовый сценарий для создания или обновления плана.",
      prompt: `Активируй в aitasker проект "${projectName}", найди задачу "${taskTitle}" (${taskId}), переведи ее в статус planning, распланируй задачу, сохрани план обратно через MCP и затем переведи задачу в статус implementation.`
    },
    {
      id: "clarify-plan",
      title: "Уточнение плана",
      description: "Пересмотреть текущий план и добавить открытые вопросы или недостающие шаги.",
      prompt: `Активируй в aitasker проект "${projectName}", открой задачу "${taskTitle}" (${taskId}), перечитай текущий план, уточни его, добавь недостающие шаги и открытые вопросы, затем сохрани обновленный план обратно через MCP.`
    },
    {
      id: "implementation",
      title: "Переход к реализации",
      description: "Использовать готовый план как вход для следующего этапа работы.",
      prompt: `Активируй в aitasker проект "${projectName}", открой задачу "${taskTitle}" (${taskId}), проверь план, приступай к реализации по шагам плана и добавляй расширения через append_plan_extension, а отдельные доработки через append_plan_improvement. Статус задачи держи implementation.`
    },
    {
      id: "finish-task",
      title: "Завершение задачи",
      description: "Закрыть задачу, синхронизировать статус и финальные расширения или доработки.",
      prompt: `Активируй в aitasker проект "${projectName}", открой задачу "${taskTitle}" (${taskId}), проверь что план выполнен, при необходимости добавь финальное расширение или доработку плана и переведи задачу в статус completed.`
    },
    {
      id: "consolidate-discussion",
      title: "Сжать переписку в план",
      description: "Собрать переписку по расширениям и доработкам обратно в единый план и очистить диалог.",
      prompt: `Активируй в aitasker проект "${projectName}", открой задачу "${taskTitle}" (${taskId}), перечитай текущий план, расширения и доработки, затем собери новый цельный Markdown-план и вызови consolidate_plan_discussion, чтобы очистить отдельные блоки переписки.`
    },
    {
      id: "project-skill",
      title: "Создание SKILL.md",
      description: "Подготовить или обновить skill-файл проекта.",
      prompt: `Активируй в aitasker проект "${projectName}", проверь карточку проекта, затем создай или обнови SKILL.md в "${detail.project.skillFilePath ?? `${projectPath}\\SKILL.md`}". После записи сохрани путь к skill-файлу в карточке проекта и кратко опиши, что вошло в SKILL.md.`
    }
  ];
}
