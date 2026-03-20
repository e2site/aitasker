/*
Назначение: Создает MCP-сервер для работы с проектами, задачами, планами, расширениями и доработками; операции записи и проектные выборки идут через активный профиль, а get_task умеет читать задачу глобально по taskId.
Не входит: HTTP-хостинг, жизненный цикл Electron-окна и прямое создание файлов внешними агентами.
*/
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findManagedPlanComment, parseManagedPlanContent } from "../../shared/plans/managed-plan-content";
import {
  serializeActivatedProject,
  serializeActiveProject,
  serializePlan,
  serializePlanExtension,
  serializePlanImprovement,
  serializeProjectCollection,
  serializeResource,
  serializeResourceCollection,
  serializeTask,
  serializeTaskCollection,
  serializeTaskDetail
} from "./mcp-response-presenters";
import { normalizeProjectName } from "../db/project-repository";
import type { AppService } from "../services/app-service";
import type { DevLogger } from "../services/dev-logger";

type ProjectRecord = Awaited<ReturnType<AppService["listProjects"]>>[number];
type TaskRecord = Awaited<ReturnType<AppService["listTasks"]>>[number];

function textContent(text: string) {
  return [{ type: "text" as const, text }];
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
        structuredContent: serializeActiveProject(project)
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
      const response = serializeProjectCollection(projects, activeProjectId);

      return {
        content: textContent(JSON.stringify(response, null, 2)),
        structuredContent: response
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
      const response = serializeProjectCollection(matches, activeProjectId);

      return {
        content: textContent(JSON.stringify(response, null, 2)),
        structuredContent: response
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
        content: textContent("Проект активирован."),
        structuredContent: serializeActivatedProject(resolved.project)
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
      const response = serializeActiveProject(project);

      return {
        content: textContent(JSON.stringify(response, null, 2)),
        structuredContent: response
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
        structuredContent: serializeActiveProject(updated)
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
        structuredContent: serializeTaskDetail(detail)
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
      const response = serializeTaskCollection(tasks, project);

      return {
        content: textContent(JSON.stringify(response, null, 2)),
        structuredContent: response
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
      const response = serializeTaskCollection(matches, project);

      return {
        content: textContent(JSON.stringify(response, null, 2)),
        structuredContent: response
      };
    }
  );

  server.registerTool(
    "get_task",
    {
      description:
        "Получить задачу по taskId без активации проекта, включая linkedResources и linkedTasks. Если linkedResources не пустой, их содержимое нужно читать отдельно через get_resource.",
      inputSchema: {
        taskId: z.string()
      }
    },
    async ({ taskId }) => {
      logger.debug("mcp", "Tool get_task called", { taskId });
      const detail = await appService.getTaskDetail(taskId);
      const response = serializeTaskDetail(detail);

      return {
        content: textContent(JSON.stringify(response, null, 2)),
        structuredContent: response
      };
    }
  );

  server.registerTool(
    "update_task_status",
    {
      description:
        "Обновить статус задачи внутри активного подготовленного проекта. Допустимые статусы: new, planning, requires_clarification, implementation, testing, completed.",
      inputSchema: {
        taskId: z.string(),
        status: z.enum(["new", "planning", "requires_clarification", "implementation", "testing", "completed"])
      }
    },
    async ({ status, taskId }) => {
      await getScopedTaskDetail(taskId);
      logger.info("mcp", "Tool update_task_status called", { taskId, status });
      const detail = await appService.updateTaskStatus({ taskId, status });

      return {
        content: textContent(`Статус задачи обновлен на ${status}.`),
        structuredContent: serializeTaskDetail(detail)
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
        structuredContent: serializePlan(detail.plan, taskId)
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
        structuredContent: serializePlanExtension(taskId, extension)
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
        structuredContent: serializePlanImprovement(taskId, improvement)
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
        structuredContent: serializePlan(detail.plan, taskId)
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
        structuredContent: serializePlan(detail.plan, taskId)
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
        structuredContent: serializePlan(detail.plan, taskId)
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
        structuredContent: serializePlan(detail.plan, taskId)
      };
    }
  );

  server.registerTool(
    "create_resource",
    {
      description: "Создать новый глобальный ресурс (Markdown-документ) не привязанный к проекту.",
      inputSchema: {
        name: z.string().min(1).max(200),
        contentMd: z.string().optional()
      }
    },
    async ({ name, contentMd }) => {
      logger.info("mcp", "Tool create_resource called", { name });
      const resource = await appService.createResource({ name, contentMd });

      return {
        content: textContent(`Ресурс "${resource.name}" создан с id ${resource.id}.`),
        structuredContent: serializeResource(resource)
      };
    }
  );

  server.registerTool(
    "get_resource",
    {
      description: "Получить ресурс по id.",
      inputSchema: {
        id: z.string()
      }
    },
    async ({ id }) => {
      logger.debug("mcp", "Tool get_resource called", { id });
      const resource = await appService.getResource(id);
      const response = serializeResource(resource);

      return {
        content: textContent(JSON.stringify(response, null, 2)),
        structuredContent: response
      };
    }
  );

  server.registerTool(
    "list_resources",
    {
      description: "Показать список всех глобальных ресурсов."
    },
    async () => {
      logger.debug("mcp", "Tool list_resources called");
      const resources = await appService.listResources();
      const response = serializeResourceCollection(resources);

      return {
        content: textContent(JSON.stringify(response, null, 2)),
        structuredContent: response
      };
    }
  );

  server.registerTool(
    "update_resource",
    {
      description: "Обновить название или содержимое ресурса.",
      inputSchema: {
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        contentMd: z.string().optional()
      }
    },
    async ({ id, name, contentMd }) => {
      logger.info("mcp", "Tool update_resource called", { id });
      const resource = await appService.updateResource({ id, name, contentMd });

      return {
        content: textContent(`Ресурс "${resource.name}" обновлен.`),
        structuredContent: serializeResource(resource)
      };
    }
  );

  server.registerTool(
    "find_resources",
    {
      description: "Найти глобальные ресурсы по названию или содержимому.",
      inputSchema: {
        query: z.string().min(1),
        limit: z.number().int().min(1).max(20).optional()
      }
    },
    async ({ query, limit }) => {
      logger.debug("mcp", "Tool find_resources called", { query });
      const resources = await appService.listResources();
      const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
      const matches = resources
        .filter((r) =>
          [r.id, r.name, r.contentMd]
            .join(" ")
            .toLocaleLowerCase("ru-RU")
            .includes(normalizedQuery)
        )
        .slice(0, limit ?? 5);
      const response = serializeResourceCollection(matches);

      return {
        content: textContent(JSON.stringify(response, null, 2)),
        structuredContent: response
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
            text: `Выполни planning задачи в AITasker через MCP.

Вход:
{
  "mcp": "aitasker",
  "action": "plan_task",
  "projectRef": "${projectRef}",
  "taskRef": "${taskRef}",
  "read": ["get_active_project", "get_task", "get_plan"],
  "write": ["save_plan", "update_task_status"],
  "statusFlow": ["planning", "implementation"],
  "rules": [
    "resolve_project",
    "resolve_task",
    "inspect_linked_resources_from_get_task",
    "read_required_resources_via_get_resource_before_answer",
    "save_open_questions_separately"
  ]
}

Доп. инструкции: ${instructions?.trim() || "none"}

После get_task обязательно проверь linkedResources. Если там есть ресурсы, прочитай нужные через get_resource до построения плана.

Не останавливайся на анализе. Сохрани результат в AITasker до финального ответа.`
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
            text: `Сожми обсуждение задачи в AITasker обратно в основной план через MCP.

Вход:
{
  "mcp": "aitasker",
  "action": "consolidate_plan_discussion",
  "projectRef": "${projectRef}",
  "taskRef": "${taskRef}",
  "read": ["get_task", "get_plan"],
  "write": ["consolidate_plan_discussion"],
  "rules": [
    "resolve_project",
    "resolve_task",
    "inspect_linked_resources_from_get_task",
    "read_required_resources_via_get_resource_before_answer",
    "merge_discussion_into_plan",
    "save_open_questions_separately"
  ]
}

Доп. инструкции: ${instructions?.trim() || "none"}

После get_task обязательно проверь linkedResources. Если они есть, прочитай относящиеся к задаче ресурсы через get_resource перед обновлением плана.

Не останавливайся на анализе. Обязательно сохрани обновленный план до финального ответа.`
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
            text: `Подготовь или обнови SKILL.md проекта в AITasker.

Вход:
{
  "mcp": "aitasker",
  "action": "sync_project_skill",
  "projectRef": "${projectRef}",
  "skillPath": "${skillPath?.trim() || ""}",
  "read": ["get_active_project"],
  "write": ["update_project_profile"],
  "rules": ["resolve_project", "determine_skill_path", "create_or_update_skill_file", "sync_skill_path_to_project_profile"]
}

Доп. инструкции: ${instructions?.trim() || "none"}

Если путь нельзя определить надежно, остановись и запроси его у пользователя.`
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
            text: JSON.stringify(serializeTask(detail.task), null, 2)
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
