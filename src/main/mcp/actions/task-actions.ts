/*
Назначение: Регистрирует MCP-экшены домена задач: создание, чтение, поиск, синхронизация состояния и смена статуса.
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

      return {
        content: textContent("Задача создана."),
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
      context.getLogger().debug("mcp", "Tool get_task called", { taskId });
      const taskContext = createTaskContext(taskId, context.getAppService());
      const snapshot = await taskContext.getSnapshot();
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
      const session = context.getAgentSession();
      context.getLogger().debug("mcp", "Tool sync_task called", {
        taskId,
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

        const snapshot = await taskContext.getSnapshot();
        context.updateAgentSession(toDeltaMode(session));
        const response = serializeDeltaSnapshot(snapshot, since);

        return {
          content: textContent(JSON.stringify(response, null, 2)),
          structuredContent: response
        };
      }

      const snapshot = await taskContext.getSnapshot();
      context.updateAgentSession(startWork(session, taskId));
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
      const taskContext = await context.requireTaskContext(taskId);
      context.touchSession({ taskId });
      context.getLogger().info("mcp", "Tool update_task_status called", { taskId, status });
      await taskContext.updateStatus(status);
      const snapshot = await taskContext.getSnapshot();

      return {
        content: textContent("Статус обновлен."),
        structuredContent: serializeTaskSnapshot(snapshot)
      };
    }
  );
}
