/*
Назначение: Создает MCP-сервер для работы с проектами, задачами, планами, расширениями и доработками; операции записи и проектные выборки идут через активный профиль, а get_task умеет читать задачу глобально по taskId.
Не входит: HTTP-хостинг, жизненный цикл Electron-окна и прямое создание файлов внешними агентами.
*/
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findManagedPlanComment, parseManagedPlanContent } from "../../shared/plans/managed-plan-content";
import { normalizeProjectName } from "../db/project-repository";
import type { AppService } from "../services/app-service";
import type { DevLogger } from "../services/dev-logger";

type ProjectRecord = Awaited<ReturnType<AppService["listProjects"]>>[number];
type TaskRecord = Awaited<ReturnType<AppService["listTasks"]>>[number];

function textContent(text: string) {
  return [{ type: "text" as const, text }];
}

function ensureStructuredPlan(
  plan: Awaited<ReturnType<AppService["getTaskDetail"]>>["plan"],
  taskId: string
) {
  if (!plan) {
    return { taskId, exists: false, contentMd: "" };
  }

  return {
    ...plan,
    contentMd: parseManagedPlanContent(plan.contentMd).renderedContentMd
  };
}

function findProjectsByQuery(projects: ProjectRecord[], query: string, limit: number) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");

  return projects
    .filter((project) => {
      const haystack = [
        project.id,
        project.name,
        project.description,
        project.rootPath ?? "",
        project.languages.join(" "),
        project.skillFilePath ?? ""
      ]
        .join(" ")
        .toLocaleLowerCase("ru-RU");

      return haystack.includes(normalizedQuery);
    })
    .slice(0, limit);
}

function findTasksByQuery(tasks: TaskRecord[], query: string, limit: number) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");

  return tasks
    .filter((task) => {
      const haystack = [
        task.id,
        task.projectId,
        task.projectName,
        task.title,
        task.description,
        task.status
      ]
        .join(" ")
        .toLocaleLowerCase("ru-RU");

      return haystack.includes(normalizedQuery);
    })
    .slice(0, limit);
}

function resolveProjectReference(projects: ProjectRecord[], projectRef: string) {
  const trimmedRef = projectRef.trim();
  const normalizedRef = normalizeProjectName(trimmedRef);
  const exactMatch =
    projects.find((project) => project.id === trimmedRef) ??
    projects.find((project) => normalizeProjectName(project.name) === normalizedRef);

  if (exactMatch) {
    return { project: exactMatch, matches: [] as ProjectRecord[] };
  }

  const matches = findProjectsByQuery(projects, trimmedRef, 10);

  return {
    project: matches.length === 1 ? matches[0] : null,
    matches
  };
}

function getProjectProfileHint(project: ProjectRecord): string {
  const missingFields: string[] = [];

  if (!project.description.trim()) {
    missingFields.push("description");
  }

  if (!project.rootPath?.trim()) {
    missingFields.push("rootPath");
  }

  if (project.languages.length === 0) {
    missingFields.push("languages");
  }

  if (missingFields.length === 0) {
    return `Профиль проекта ${project.name} заполнен.`;
  }

  return `Профиль проекта ${project.name} не заполнен: ${missingFields.join(", ")}. Сначала вызовите update_project_profile.`;
}

export function createMcpServer(appService: AppService, logger: DevLogger): McpServer {
  const server = new McpServer(
    {
      name: "aitasker-mcp",
      version: "1.0.0"
    },
    {
      capabilities: {
        logging: {}
      }
    }
  );
  let activeProjectId: string | null = null;

  const requireActiveProject = async (): Promise<ProjectRecord> => {
    if (!activeProjectId) {
      throw new Error("Проект не активирован. Сначала вызовите activate_project.");
    }

    const project = await appService.getProject(activeProjectId);

    if (!project) {
      activeProjectId = null;
      throw new Error("Активный проект больше не существует. Активируйте проект заново.");
    }

    return project;
  };

  const requirePreparedProject = async (): Promise<ProjectRecord> => {
    const project = await requireActiveProject();

    if (!project.isProfileComplete) {
      throw new Error(getProjectProfileHint(project));
    }

    return project;
  };

  const getScopedTaskDetail = async (taskId: string) => {
    const project = await requirePreparedProject();
    const detail = await appService.getTaskDetail(taskId, project.id);

    return { detail, project };
  };

  server.registerTool(
    "create_project",
    {
      description: "Создать новый проект для дальнейшей работы с задачами.",
      inputSchema: {
        name: z.string().min(2).max(80)
      }
    },
    async ({ name }) => {
      logger.info("mcp", "Tool create_project called", { name });
      const project = await appService.createProject({ name });

      return {
        content: textContent(`Проект ${project.name} готов. ${getProjectProfileHint(project)}`),
        structuredContent: project
      };
    }
  );

  server.registerTool(
    "list_projects",
    {
      description: "Показать список всех проектов, доступных в AITasker."
    },
    async () => {
      logger.debug("mcp", "Tool list_projects called");
      const projects = await appService.listProjects();

      return {
        content: textContent(JSON.stringify(projects, null, 2)),
        structuredContent: { projects, activeProjectId }
      };
    }
  );

  server.registerTool(
    "find_projects",
    {
      description: "Найти проект по id, названию, пути или описанию перед активацией.",
      inputSchema: {
        query: z.string().min(1),
        limit: z.number().int().min(1).max(20).optional()
      }
    },
    async ({ limit, query }) => {
      logger.debug("mcp", "Tool find_projects called", { query, limit: limit ?? 5 });
      const projects = await appService.listProjects();
      const matches = findProjectsByQuery(projects, query, limit ?? 5);

      return {
        content: textContent(JSON.stringify(matches, null, 2)),
        structuredContent: { projects: matches, activeProjectId }
      };
    }
  );

  server.registerTool(
    "activate_project",
    {
      description:
        "Активировать проект в текущей MCP-сессии. После активации агент должен проверить и заполнить карточку проекта через update_project_profile.",
      inputSchema: {
        projectRef: z.string().min(1)
      }
    },
    async ({ projectRef }) => {
      logger.info("mcp", "Tool activate_project called", { projectRef });
      const projects = await appService.listProjects();
      const resolved = resolveProjectReference(projects, projectRef);

      if (!resolved.project && resolved.matches.length > 1) {
        throw new Error(
          `Найдено несколько проектов по запросу "${projectRef}". Уточните проект через id или точное имя.`
        );
      }

      if (!resolved.project) {
        throw new Error(`Проект "${projectRef}" не найден.`);
      }

      activeProjectId = resolved.project.id;

      return {
        content: textContent(`Активирован проект ${resolved.project.name}. ${getProjectProfileHint(resolved.project)}`),
        structuredContent: resolved.project
      };
    }
  );

  server.registerTool(
    "get_active_project",
    {
      description: "Показать активный проект текущей MCP-сессии вместе с карточкой профиля."
    },
    async () => {
      logger.debug("mcp", "Tool get_active_project called");
      const project = await requireActiveProject();

      return {
        content: textContent(JSON.stringify(project, null, 2)),
        structuredContent: project
      };
    }
  );

  server.registerTool(
    "update_project_profile",
    {
      description:
        "Заполнить или уточнить карточку активного проекта: название, описание, путь, языки и путь к SKILL.md.",
      inputSchema: {
        name: z.string().min(2).max(80).optional(),
        description: z.string().max(4_000).optional(),
        rootPath: z.string().min(1).max(500).nullable().optional(),
        languages: z.array(z.string().min(1).max(40)).max(20).optional(),
        skillFilePath: z.string().min(1).max(500).nullable().optional(),
        skillPrompt: z.string().max(4_000).optional()
      }
    },
    async (input) => {
      const project = await requireActiveProject();
      logger.info("mcp", "Tool update_project_profile called", { projectId: project.id });
      const updated = await appService.updateProjectProfile({
        projectId: project.id,
        ...input
      });

      return {
        content: textContent(`Карточка проекта ${updated.name} обновлена.`),
        structuredContent: updated
      };
    }
  );

  server.registerTool(
    "create_task",
    {
      description: "Создать новую задачу в активном проекте с заполненной карточкой.",
      inputSchema: {
        title: z.string().min(3),
        description: z.string().min(12)
      }
    },
    async ({ description, title }) => {
      const project = await requirePreparedProject();
      logger.info("mcp", "Tool create_task called", { projectId: project.id, title });
      const detail = await appService.createTask({ title, description, projectId: project.id });

      return {
        content: textContent(`Задача ${detail.task.id} создана в проекте ${project.name} со статусом new.`),
        structuredContent: detail
      };
    }
  );

  server.registerTool(
    "list_tasks",
    {
      description: "Показать задачи активного проекта с заполненной карточкой."
    },
    async () => {
      const project = await requirePreparedProject();
      logger.debug("mcp", "Tool list_tasks called", { projectId: project.id });
      const tasks = await appService.listTasks(project.id);

      return {
        content: textContent(JSON.stringify(tasks, null, 2)),
        structuredContent: { project, tasks }
      };
    }
  );

  server.registerTool(
    "find_tasks",
    {
      description:
        "Найти задачи внутри активного проекта с заполненной карточкой по id, названию, описанию или статусу.",
      inputSchema: {
        query: z.string().min(1),
        limit: z.number().int().min(1).max(20).optional()
      }
    },
    async ({ limit, query }) => {
      const project = await requirePreparedProject();
      logger.debug("mcp", "Tool find_tasks called", {
        projectId: project.id,
        query,
        limit: limit ?? 5
      });
      const tasks = await appService.listTasks(project.id);
      const matches = findTasksByQuery(tasks, query, limit ?? 5);

      return {
        content: textContent(JSON.stringify(matches, null, 2)),
        structuredContent: { project, tasks: matches }
      };
    }
  );

  server.registerTool(
    "get_task",
    {
      description: "Получить задачу и ее текущий план по taskId без активации проекта.",
      inputSchema: {
        taskId: z.string()
      }
    },
    async ({ taskId }) => {
      logger.debug("mcp", "Tool get_task called", { taskId });
      const detail = await appService.getTaskDetail(taskId);

      return {
        content: textContent(JSON.stringify(detail, null, 2)),
        structuredContent: detail
      };
    }
  );

  server.registerTool(
    "update_task_status",
    {
      description:
        "Обновить статус задачи внутри активного подготовленного проекта. Допустимые статусы: new, planning, requires_clarification, implementation, completed.",
      inputSchema: {
        taskId: z.string(),
        status: z.enum(["new", "planning", "requires_clarification", "implementation", "completed"])
      }
    },
    async ({ status, taskId }) => {
      await getScopedTaskDetail(taskId);
      logger.info("mcp", "Tool update_task_status called", { taskId, status });
      const detail = await appService.updateTaskStatus({ taskId, status });

      return {
        content: textContent(`Статус задачи обновлен на ${status}.`),
        structuredContent: detail
      };
    }
  );

  server.registerTool(
    "get_plan",
    {
      description: "Получить текущий Markdown-план задачи вместе с расширениями и доработками внутри активного подготовленного проекта.",
      inputSchema: {
        taskId: z.string()
      }
    },
    async ({ taskId }) => {
      logger.debug("mcp", "Tool get_plan called", { taskId });
      const { detail } = await getScopedTaskDetail(taskId);

      return {
        content: textContent(detail.plan ? parseManagedPlanContent(detail.plan.contentMd).renderedContentMd : ""),
        structuredContent: ensureStructuredPlan(detail.plan, taskId)
      };
    }
  );

  server.registerTool(
    "get_plan_extension",
    {
      description: "Получить одно конкретное расширение плана по extensionId без чтения всего плана.",
      inputSchema: {
        taskId: z.string(),
        extensionId: z.string().min(1)
      }
    },
    async ({ extensionId, taskId }) => {
      logger.debug("mcp", "Tool get_plan_extension called", { taskId, extensionId });
      const { detail } = await getScopedTaskDetail(taskId);

      if (!detail.plan) {
        throw new Error(`План задачи ${taskId} не найден.`);
      }

      const extension = findManagedPlanComment(detail.plan.contentMd, "extension", extensionId);

      if (!extension) {
        throw new Error(`Расширение ${extensionId} для задачи ${taskId} не найдено.`);
      }

      return {
        content: textContent(extension.content),
        structuredContent: {
          extension,
          taskId
        }
      };
    }
  );

  server.registerTool(
    "get_plan_improvement",
    {
      description: "Получить одну конкретную доработку плана по improvementId без чтения всего плана.",
      inputSchema: {
        taskId: z.string(),
        improvementId: z.string().min(1)
      }
    },
    async ({ improvementId, taskId }) => {
      logger.debug("mcp", "Tool get_plan_improvement called", { taskId, improvementId });
      const { detail } = await getScopedTaskDetail(taskId);

      if (!detail.plan) {
        throw new Error(`План задачи ${taskId} не найден.`);
      }

      const improvement = findManagedPlanComment(detail.plan.contentMd, "improvement", improvementId);

      if (!improvement) {
        throw new Error(`Доработка ${improvementId} для задачи ${taskId} не найдена.`);
      }

      return {
        content: textContent(improvement.content),
        structuredContent: {
          improvement,
          taskId
        }
      };
    }
  );

  server.registerTool(
    "save_plan",
    {
      description: "Сохранить Markdown-план и отдельный список открытых вопросов для задачи внутри активного подготовленного проекта.",
      inputSchema: {
        taskId: z.string(),
        contentMd: z.string().min(1),
        openQuestions: z.array(z.string().min(1)).optional(),
        source: z.enum(["human", "agent"]).optional()
      }
    },
    async ({ contentMd, openQuestions, source, taskId }) => {
      await getScopedTaskDetail(taskId);
      logger.info("mcp", "Tool save_plan called", {
        taskId,
        openQuestionsCount: openQuestions?.length ?? 0,
        source: source ?? "agent"
      });
      const detail = await appService.savePlan({
        taskId,
        contentMd,
        openQuestions,
        source: source ?? "agent"
      });

      return {
        content: textContent("План сохранен."),
        structuredContent: ensureStructuredPlan(detail.plan, taskId)
      };
    }
  );

  server.registerTool(
    "append_plan_extension",
    {
      description: "Добавить расширение текущего плана задачи без создания новой ревизии.",
      inputSchema: {
        taskId: z.string(),
        content: z.string().min(1)
      }
    },
    async ({ content, taskId }) => {
      await getScopedTaskDetail(taskId);
      logger.info("mcp", "Tool append_plan_extension called", { taskId });
      const detail = await appService.appendPlanExtension({ taskId, content, author: "agent" });

      return {
        content: textContent("Расширение плана добавлено."),
        structuredContent: ensureStructuredPlan(detail.plan, taskId)
      };
    }
  );

  server.registerTool(
    "append_plan_improvement",
    {
      description: "Добавить доработку плана отдельным блоком без создания новой ревизии.",
      inputSchema: {
        taskId: z.string(),
        content: z.string().min(1)
      }
    },
    async ({ content, taskId }) => {
      await getScopedTaskDetail(taskId);
      logger.info("mcp", "Tool append_plan_improvement called", { taskId });
      const detail = await appService.appendPlanImprovement({ taskId, content, author: "agent" });

      return {
        content: textContent("Доработка плана добавлена."),
        structuredContent: ensureStructuredPlan(detail.plan, taskId)
      };
    }
  );

  server.registerTool(
    "consolidate_plan_discussion",
    {
      description:
        "Сжать переписку по плану в новый Markdown-план, при необходимости сохранить новый список открытых вопросов и очистить отдельные блоки обсуждения.",
      inputSchema: {
        taskId: z.string(),
        contentMd: z.string().min(1),
        openQuestions: z.array(z.string().min(1)).optional(),
        source: z.enum(["human", "agent"]).optional()
      }
    },
    async ({ contentMd, openQuestions, source, taskId }) => {
      await getScopedTaskDetail(taskId);
      logger.info("mcp", "Tool consolidate_plan_discussion called", {
        taskId,
        openQuestionsCount: openQuestions?.length ?? 0,
        source: source ?? "agent"
      });
      const detail = await appService.consolidatePlanDiscussion({
        taskId,
        contentMd,
        openQuestions,
        source: source ?? "agent"
      });

      return {
        content: textContent("Переписка по плану сжата в текущий план и очищена из отдельных блоков."),
        structuredContent: ensureStructuredPlan(detail.plan, taskId)
      };
    }
  );

  server.registerPrompt(
    "plan_task",
    {
      description: "Провести planning задачи из AITasker внутри выбранного проекта и сохранить Markdown-план обратно.",
      argsSchema: {
        projectRef: z
          .string()
          .min(1)
          .describe("Id или читаемое имя проекта, внутри которого нужно работать."),
        taskRef: z
          .string()
          .min(1)
          .describe("Id задачи или человекочитаемое название задачи из запроса пользователя."),
        instructions: z
          .string()
          .optional()
          .describe("Дополнительные ограничения или пожелания к плану.")
      }
    },
    async ({ instructions, projectRef, taskRef }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Ты планируешь задачу, сохраненную в AITasker.

Проект из запроса пользователя: ${projectRef}
Ссылка на задачу из запроса пользователя: ${taskRef}
Дополнительные инструкции: ${instructions?.trim() || "none"}

Обязательный workflow:
1. Разреши проект и активируй его.
Сначала вызови activate_project с projectRef.
Если проект не найден, используй find_projects.
Если совпадений несколько, остановись и попроси пользователя уточнить проект.

2. Прочитай карточку проекта.
Сразу после активации вызови get_active_project.
Если description, rootPath или languages пустые, заполни карточку через update_project_profile.
Пытайся определить:
- точное название проекта
- краткое описание
- путь к рабочей директории
- используемые языки

3. Разреши задачу внутри активного проекта.
Если taskRef не является точным task id, вызови find_tasks.
Если совпадений несколько, остановись и попроси пользователя уточнить задачу.

4. Переведи задачу в статус planning.
После того как задача разрешена, вызови update_task_status с status="planning".

5. Прочитай контекст задачи.
Вызови get_task с точным task id.
Если у задачи уже есть план, расширения или доработки, также вызови get_plan.

6. Подготовь Markdown в формате:

# План задачи

## Цель
...

## Контекст
...

## Шаги
1. ...
2. ...
3. ...

## Критерии готовности
- ...

7. Если есть незакрытые вопросы, собери их отдельным списком строк. Не записывай их в markdown-план.

8. Сохрани итоговый Markdown через save_plan с source="agent". Если есть открытые вопросы, передай их отдельным полем openQuestions.

9. После сохранения переведи задачу в статус implementation через update_task_status.

10. После сохранения ответь кратко:
- какой проект был активирован
- карточка проекта была заполнена или уже была заполнена
- какая задача была распланирована
- какой статус был выставлен после планирования
- план был создан или обновлен
- были ли сохранены открытые вопросы отдельно
- короткая сводка плана

Не останавливайся после анализа. Сохрани Markdown обратно в AITasker до финального ответа.`
          }
        }
      ]
    })
  );

  server.registerPrompt(
    "compress_plan_discussion",
    {
      description:
        "Сжать переписку по расширениям и доработкам задачи в обновленный Markdown-план и очистить отдельные discussion-блоки.",
      argsSchema: {
        projectRef: z
          .string()
          .min(1)
          .describe("Id или читаемое имя проекта, внутри которого нужно работать."),
        taskRef: z
          .string()
          .min(1)
          .describe("Id задачи или человекочитаемое название задачи из запроса пользователя."),
        instructions: z
          .string()
          .optional()
          .describe("Дополнительные ограничения к обновленному плану после сжатия переписки.")
      }
    },
    async ({ instructions, projectRef, taskRef }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Ты сжимаешь переписку по задаче, сохраненной в AITasker, обратно в основной план.

Проект из запроса пользователя: ${projectRef}
Ссылка на задачу из запроса пользователя: ${taskRef}
Дополнительные инструкции: ${instructions?.trim() || "none"}

Обязательный workflow:
1. Активируй проект через activate_project. Если проект не найден, используй find_projects.
2. Сразу вызови get_active_project и убедись, что карточка проекта заполнена.
3. Разреши задачу внутри активного проекта. Если taskRef не является точным task id, используй find_tasks.
4. Прочитай задачу через get_task, затем обязательно вызови get_plan.
5. На основе текущего плана, открытых вопросов и переписки подготовь новый цельный Markdown-план без отдельных discussion-блоков.
6. Если после сжатия остаются незакрытые вопросы, собери их отдельным списком строк. Не записывай их в markdown-план.
7. Сохрани обновленный план через consolidate_plan_discussion с source="agent". Если остаются открытые вопросы, передай их отдельным полем openQuestions.
8. После сохранения ответь кратко:
- какой проект был активирован
- какая задача была обновлена
- какие ключевые изменения попали в новый план
- остались ли отдельные открытые вопросы после сжатия
- подтверждение, что расширения и доработки были очищены из отдельных блоков

Не останавливайся на анализе. Обязательно вызови consolidate_plan_discussion до финального ответа.`
          }
        }
      ]
    })
  );

  server.registerPrompt(
    "create_project_skill",
    {
      description:
        "Подготовить или обновить SKILL.md для активного проекта, сохранить путь к нему в карточке проекта и затем кратко отчитаться.",
      argsSchema: {
        projectRef: z
          .string()
          .min(1)
          .describe("Id или название проекта, для которого нужно создать skill."),
        skillPath: z
          .string()
          .optional()
          .describe("Необязательный путь к SKILL.md. Если не указан, используй skillFilePath из проекта или <rootPath>/SKILL.md."),
        instructions: z
          .string()
          .optional()
          .describe("Дополнительные требования к содержимому skill-файла.")
      }
    },
    async ({ instructions, projectRef, skillPath }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Ты подготавливаешь SKILL.md для проекта в AITasker.

Проект из запроса пользователя: ${projectRef}
Путь к skill-файлу из запроса: ${skillPath?.trim() || "not provided"}
Дополнительные инструкции: ${instructions?.trim() || "none"}

Обязательный workflow:
1. Активируй проект через activate_project.
Если проект не найден, используй find_projects.

2. Сразу прочитай карточку проекта через get_active_project.
Если description, rootPath или languages пустые, сначала заполни карточку через update_project_profile.

3. Определи путь к skill-файлу.
Приоритет:
- путь из skillPath
- skillFilePath из карточки проекта
- <rootPath>/SKILL.md
Если rootPath отсутствует и путь нельзя определить надежно, остановись и попроси пользователя указать путь.

4. Создай или обнови SKILL.md на диске проекта своими файловыми инструментами.
Файл должен помогать выполнять типовые задачи по проекту: workflow, ограничения, соглашения по коду, важные команды, структура и правила.

5. После записи файла вызови update_project_profile и сохрани:
- skillFilePath
- при необходимости skillPrompt
- уточненные description/rootPath/languages, если в ходе анализа нашлись более точные значения

6. Ответь кратко:
- какой проект активирован
- где создан или обновлен SKILL.md
- что именно описано в skill-файле

Не останавливайся на плане. Если у тебя есть доступ к файловым инструментам, создай или обнови SKILL.md перед финальным ответом.`
          }
        }
      ]
    })
  );

  server.registerResource(
    "task-resource",
    new ResourceTemplate("task://{id}", { list: undefined }),
    {
      description: "JSON задачи из активного подготовленного проекта"
    },
    async (uri, variables) => {
      const { detail } = await getScopedTaskDetail(String(variables.id));

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(detail.task, null, 2)
          }
        ]
      };
    }
  );

  server.registerResource(
    "plan-resource",
    new ResourceTemplate("plan://{taskId}", { list: undefined }),
    {
      description: "Markdown-план задачи из активного подготовленного проекта"
    },
    async (uri, variables) => {
      const { detail } = await getScopedTaskDetail(String(variables.taskId));

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: detail.plan ? parseManagedPlanContent(detail.plan.contentMd).renderedContentMd : ""
          }
        ]
      };
    }
  );

  return server;
}
