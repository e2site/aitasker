/*
Назначение: Регистрирует MCP-экшены домена задач и подзадач: создание, чтение, поиск, синхронизация состояния и смена статуса.
Не входит: Операции с карточкой проекта, план-обсуждением, ресурсами и prompt-ами.
*/
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { serializeDeltaSnapshot, serializeTaskCollection, serializeTaskDetail, serializeTaskSnapshot } from "../mcp-response-presenters";
import { createTaskContext } from "../../services/task-context";
import { startWork, toDeltaMode } from "../agent-session";
import { findTasksByQuery, textContent, type McpControllerContext } from "../controller/mcp-controller-context";

export function registerTaskActions(server: McpServer, context: McpControllerContext) {
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
      const project = await context.requirePreparedProject();
      context.getLogger().info("mcp", "Tool create_task called", { projectId: project.id, title });
      const detail = await context.getAppService().createTask({ title, description, projectId: project.id });
      const projectTasks = await context.getAppService().listTasks(project.id);

      return {
        content: textContent("Задача создана."),
        structuredContent: serializeTaskDetail(detail, projectTasks)
      };
    }
  );

  server.registerTool(
    "create_sub_task",
    {
      description: "Создать подзадачу внутри активного подготовленного проекта по id родительской задачи.",
      inputSchema: {
        parentTaskId: z.string().min(1),
        title: z.string().min(3),
        description: z.string().min(12)
      }
    },
    async ({ description, parentTaskId, title }) => {
      const project = await context.requirePreparedProject();
      const parentDetail = await context.getAppService().getTaskDetail(parentTaskId);

      if (parentDetail.task.projectId !== project.id) {
        throw new Error("Родительская задача должна находиться в активном проекте.");
      }

      context.getLogger().info("mcp", "Tool create_sub_task called", {
        parentTaskId,
        projectId: project.id,
        title
      });
      const detail = await context.getAppService().createTask({
        description,
        parentTaskId,
        projectId: project.id,
        title
      });
      const projectTasks = await context.getAppService().listTasks(project.id);

      return {
        content: textContent("Подзадача создана."),
        structuredContent: serializeTaskDetail(detail, projectTasks)
      };
    }
  );

  server.registerTool(
    "list_tasks",
    {
      description: "Показать задачи активного проекта с заполненной карточкой."
    },
    async () => {
      const project = await context.requirePreparedProject();
      context.getLogger().debug("mcp", "Tool list_tasks called", { projectId: project.id });
      const tasks = await context.getAppService().listTasks(project.id);
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
      const project = await context.requirePreparedProject();
      context.getLogger().debug("mcp", "Tool find_tasks called", {
        projectId: project.id,
        query,
        limit: limit ?? 5
      });
      const tasks = await context.getAppService().listTasks(project.id);
      const matches = findTasksByQuery(tasks, query, limit ?? 5);
      const response = serializeTaskCollection(matches, project, tasks);

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
      context.getLogger().debug("mcp", "Tool get_task called", { taskId });
      const taskContext = createTaskContext(taskId, context.getAppService());
      const snapshot = await taskContext.getSnapshot();
      const projectTasks = await context.getAppService().listTasks(snapshot.project.id);
      const response = serializeTaskSnapshot(snapshot, projectTasks);

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
        "Синхронизировать задачу с сессией. Первый вызов возвращает полный снапшот и переводит сессию в work-режим. Повторные вызовы в рамках той же сессии возвращают только изменения с момента первого вызова (delta-режим). Если проект задачи не активирован, активируется автоматически.",
      inputSchema: {
        taskId: z.string()
      }
    },
    async ({ taskId }) => {
      const activeProjectId = context.getActiveProjectId();
      const detail = await context.getAppService().getTaskDetail(taskId);
      const taskProjectId = detail.task.projectId;

      if (activeProjectId !== taskProjectId) {
        context.setActiveProjectId(taskProjectId);
        context.resetSession();
        context.getLogger().info("mcp", "Tool sync_task auto-activated project", {
          taskId,
          previousProjectId: activeProjectId,
          projectId: taskProjectId
        });
      }

      const session = context.getAgentSession();
      context.getLogger().debug("mcp", "Tool sync_task called", {
        taskId,
        projectId: taskProjectId,
        mode: session.lastMode,
        sessionTaskId: session.taskId
      });
      const taskContext = await context.requireTaskContext(taskId);

      const isDelta =
        session.lastMode !== null &&
        session.taskId === taskId &&
        session.lastContextVersion !== null;

      if (isDelta) {
        const since = session.lastContextVersion;

        if (since === null) {
          throw new Error("Не удалось вычислить контекст для delta-режима.");
        }

        const [snapshot, projectTasks] = await Promise.all([
          taskContext.getSnapshot(),
          context.getAppService().listTasks(taskProjectId)
        ]);
        context.updateAgentSession(toDeltaMode(session));
        const response = serializeDeltaSnapshot(snapshot, since, projectTasks);

        return {
          content: textContent(JSON.stringify(response, null, 2)),
          structuredContent: response
        };
      }

      const [snapshot, projectTasks] = await Promise.all([
        taskContext.getSnapshot(),
        context.getAppService().listTasks(taskProjectId)
      ]);
      context.updateAgentSession(startWork(session, taskId));
      const response = serializeTaskSnapshot(snapshot, projectTasks);

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
      const taskContext = await context.requireTaskContext(taskId);
      context.touchSession({ taskId });
      context.getLogger().info("mcp", "Tool update_task_status called", { taskId, status });
      await taskContext.updateStatus(status);
      const snapshot = await taskContext.getSnapshot();
      const projectTasks = await context.getAppService().listTasks(snapshot.project.id);

      return {
        content: textContent("Статус обновлен."),
        structuredContent: serializeTaskSnapshot(snapshot, projectTasks)
      };
    }
  );
}
