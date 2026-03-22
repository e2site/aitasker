/*
Назначение: Регистрирует MCP-экшены домена проектов: создание, поиск, активация и обновление профиля проекта.
Не входит: Операции с задачами, планами, ресурсами и состоянием агентской сессии.
*/
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { serializeActivatedProject, serializeActiveProject, serializeProjectCollection } from "../mcp-response-presenters";
import {
  findProjectsByQuery,
  resolveProjectReference,
  textContent,
  type McpControllerContext
} from "../controller/mcp-controller-context";

export function registerProjectActions(server: McpServer, context: McpControllerContext) {
  server.registerTool(
    "create_project",
    {
      description: "Создать новый проект для дальнейшей работы с задачами.",
      inputSchema: {
        name: z.string().min(2).max(80)
      }
    },
    async ({ name }) => {
      context.getLogger().info("mcp", "Tool create_project called", { name });
      const project = await context.getAppService().createProject({ name });

      return {
        content: textContent("Проект создан."),
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
      context.getLogger().debug("mcp", "Tool list_projects called");
      const projects = await context.getAppService().listProjects();
      const response = serializeProjectCollection(projects, context.getActiveProjectId());

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
      context.getLogger().debug("mcp", "Tool find_projects called", { query, limit: limit ?? 5 });
      const projects = await context.getAppService().listProjects();
      const matches = findProjectsByQuery(projects, query, limit ?? 5);
      const response = serializeProjectCollection(matches, context.getActiveProjectId());

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
      context.getLogger().info("mcp", "Tool activate_project called", { projectRef });
      const projects = await context.getAppService().listProjects();
      const resolved = resolveProjectReference(projects, projectRef);

      if (!resolved.project && resolved.matches.length > 1) {
        throw new Error(
          `Найдено несколько проектов по запросу "${projectRef}". Уточните проект через id или точное имя.`
        );
      }

      if (!resolved.project) {
        throw new Error(`Проект "${projectRef}" не найден.`);
      }

      context.setActiveProjectId(resolved.project.id);
      context.resetSession();

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
      context.getLogger().debug("mcp", "Tool get_active_project called");
      const project = await context.requireActiveProject();
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
      const project = await context.requireActiveProject();
      context.getLogger().info("mcp", "Tool update_project_profile called", { projectId: project.id });
      await context.getAppService().updateProjectProfile({
        projectId: project.id,
        ...input
      });

      return {
        content: textContent("Профиль обновлен.")
      };
    }
  );
}
