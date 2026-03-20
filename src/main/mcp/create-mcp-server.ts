/*
Назначение: Создает MCP-сервер для работы с проектами, задачами, планами, расширениями и доработками; операции записи и проектные выборки идут через активный профиль, а get_task умеет читать задачу глобально по taskId.
Не входит: HTTP-хостинг, жизненный цикл Electron-окна и прямое создание файлов внешними агентами.
*/
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildRegisteredPromptMessage } from "../../renderer/components/mcp-prompt-presets";
import {
  serializeActivatedProject,
  serializeActiveProject,
  serializeAgentSession,
  serializePlan,
  serializeProjectCollection,
  serializeResource,
  serializeResourceCollection,
  serializeTask,
  serializeDeltaSnapshot,
  serializeTaskCollection,
  serializeTaskDetail,
  serializeTaskSnapshot
} from "./mcp-response-presenters";
import { createFreshSession, generateRunId, startWork, toDeltaMode, touchSession } from "./agent-session";
import type { AgentSession } from "./agent-session";
import { createTaskContext } from "../services/task-context";
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

  let agentSession: AgentSession = createFreshSession(generateRunId());

  function touch(patch: { taskId?: string; mode?: AgentSession["lastMode"] }) {
    agentSession = touchSession(agentSession, patch);
  }

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

  const requireTaskContext = async (taskId: string) => {
    await requirePreparedProject();

    return createTaskContext(taskId, appService);
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

      // Новый runId сигнализирует о начале новой сессии → сброс состояния
      agentSession = createFreshSession(generateRunId());

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
        "Получить полную информацию о задаче по taskId: task, plan (включая contentMd и все комментарии), linkedResources, linkedTasks.",
      inputSchema: {
        taskId: z.string()
      }
    },
    async ({ taskId }) => {
      logger.debug("mcp", "Tool get_task called", { taskId });
      const ctx = createTaskContext(taskId, appService);
      const snapshot = await ctx.getSnapshot();
      const response = serializeTaskSnapshot(snapshot);

      return {
        content: textContent(JSON.stringify(response, null, 2)),
        structuredContent: response
      };
    }
  );

  server.registerTool(
    "sync_task",
    {
      description:
        "Синхронизировать задачу с сессией. Первый вызов возвращает полный снапшот и переводит сессию в work-режим. Повторные вызовы в рамках той же сессии возвращают только изменения с момента первого вызова (delta-режим). Требует активного подготовленного проекта.",
      inputSchema: {
        taskId: z.string()
      }
    },
    async ({ taskId }) => {
      logger.debug("mcp", "Tool sync_task called", { taskId, mode: agentSession.lastMode, sessionTaskId: agentSession.taskId });
      const ctx = await requireTaskContext(taskId);

      // delta: та же задача, сессия уже в work/delta и есть lastContextVersion
      const isDelta =
        agentSession.lastMode !== null &&
        agentSession.taskId === taskId &&
        agentSession.lastContextVersion !== null;

      if (isDelta) {
        const since = agentSession.lastContextVersion!;
        const snapshot = await ctx.getSnapshot();
        agentSession = toDeltaMode(agentSession);
        const response = serializeDeltaSnapshot(snapshot, since);

        return {
          content: textContent(JSON.stringify(response, null, 2)),
          structuredContent: response
        };
      }

      // work: первый вызов или смена задачи — полный снапшот
      const snapshot = await ctx.getSnapshot();
      agentSession = startWork(agentSession, taskId);
      const response = serializeTaskSnapshot(snapshot);

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
      const ctx = await requireTaskContext(taskId);
      touch({ taskId });
      logger.info("mcp", "Tool update_task_status called", { taskId, status });
      await ctx.updateStatus(status);
      const snapshot = await ctx.getSnapshot();

      return {
        content: textContent(`Статус задачи обновлен на ${status}.`),
        structuredContent: serializeTaskSnapshot(snapshot)
      };
    }
  );

  server.registerTool(
    "answer_plan_question",
    {
      description: "Ответить на открытый вопрос плана по questionId. Ответ переносится в discussion, вопрос удаляется из списка открытых.",
      inputSchema: {
        taskId: z.string(),
        questionId: z.string().min(1),
        answer: z.string().min(1)
      }
    },
    async ({ answer, questionId, taskId }) => {
      const ctx = await requireTaskContext(taskId);
      touch({ taskId });
      logger.info("mcp", "Tool answer_plan_question called", { questionId, taskId });
      await ctx.answerQuestion(questionId, answer);
      const snapshot = await ctx.getSnapshot();

      return {
        content: textContent("Ответ на открытый вопрос сохранен."),
        structuredContent: serializeTaskSnapshot(snapshot)
      };
    }
  );

  server.registerTool(
    "add_plan_questions",
    {
      description: "Добавить один или несколько открытых вопросов к задаче без изменения плана. Используй когда нужно уточнить требования у пользователя.",
      inputSchema: {
        taskId: z.string(),
        questions: z.array(z.string().min(1)).min(1)
      }
    },
    async ({ questions, taskId }) => {
      const ctx = await requireTaskContext(taskId);
      touch({ taskId });
      logger.info("mcp", "Tool add_plan_questions called", { taskId, count: questions.length });
      for (const content of questions) {
        await ctx.addQuestion(content);
      }
      const snapshot = await ctx.getSnapshot();

      return {
        content: textContent(`Добавлено вопросов: ${questions.length}.`),
        structuredContent: serializeTaskSnapshot(snapshot)
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
        openQuestions: z.array(z.string().min(1)).optional()
      }
    },
    async ({ contentMd, openQuestions, taskId }) => {
      const ctx = await requireTaskContext(taskId);
      touch({ taskId });
      logger.info("mcp", "Tool save_plan called", {
        taskId,
        openQuestionsCount: openQuestions?.length ?? 0
      });
      await ctx.savePlan(contentMd, openQuestions, "agent");
      const plan = await ctx.getPlan();

      return {
        content: textContent("План сохранен."),
        structuredContent: serializePlan(plan, taskId)
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
      const ctx = await requireTaskContext(taskId);
      touch({ taskId });
      logger.info("mcp", "Tool append_plan_extension called", { taskId });
      await ctx.appendExtension(content);
      const plan = await ctx.getPlan();

      return {
        content: textContent("Расширение плана добавлено."),
        structuredContent: serializePlan(plan, taskId)
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
      const ctx = await requireTaskContext(taskId);
      touch({ taskId });
      logger.info("mcp", "Tool append_plan_improvement called", { taskId });
      await ctx.appendImprovement(content);
      const plan = await ctx.getPlan();

      return {
        content: textContent("Доработка плана добавлена."),
        structuredContent: serializePlan(plan, taskId)
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
        openQuestions: z.array(z.string().min(1)).optional()
      }
    },
    async ({ contentMd, openQuestions, taskId }) => {
      const ctx = await requireTaskContext(taskId);
      touch({ taskId });
      logger.info("mcp", "Tool consolidate_plan_discussion called", {
        taskId,
        openQuestionsCount: openQuestions?.length ?? 0
      });
      await ctx.consolidateDiscussion(contentMd, openQuestions, "agent");
      const plan = await ctx.getPlan();

      return {
        content: textContent("Переписка по плану сжата в текущий план и очищена из отдельных блоков."),
        structuredContent: serializePlan(plan, taskId)
      };
    }
  );

  server.registerTool(
    "get_session_state",
    {
      description:
        "Получить текущее состояние MCP-сессии: над какой задачей работает агент, насколько свеж контекст и сколько шагов уже сделано. Используй перед началом работы с задачей, чтобы понять, нужно ли перечитывать контекст."
    },
    async () => {
      logger.debug("mcp", "Tool get_session_state called");
      const response = serializeAgentSession(agentSession);

      return {
        content: textContent(JSON.stringify(response, null, 2)),
        structuredContent: response
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
            text: buildRegisteredPromptMessage("plan_task", { instructions, projectRef, taskRef })
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
            text: buildRegisteredPromptMessage("compress_plan_discussion", { instructions, projectRef, taskRef })
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
            text: buildRegisteredPromptMessage("create_project_skill", { instructions, projectRef, skillPath })
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
      const ctx = await requireTaskContext(String(variables.id));
      const task = await ctx.getTask();

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(serializeTask(task), null, 2)
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
      const ctx = await requireTaskContext(String(variables.taskId));
      const plan = await ctx.getPlan();

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: plan?.contentMd ?? ""
          }
        ]
      };
    }
  );

  return server;
}
