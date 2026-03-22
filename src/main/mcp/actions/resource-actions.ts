/*
Назначение: Регистрирует MCP-экшены домена ресурсов: создание, чтение, обновление, список и полнотекстовый поиск.
Не входит: Операции с проектами, задачами, планами и состоянием сессии.
*/
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { serializeResource, serializeResourceCollection } from "../mcp-response-presenters";
import { textContent, type McpControllerContext } from "../controller/mcp-controller-context";

export function registerResourceActions(server: McpServer, context: McpControllerContext) {
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
      context.getLogger().info("mcp", "Tool create_resource called", { name });
      const resource = await context.getAppService().createResource({ name, contentMd });

      return {
        content: textContent("Ресурс создан."),
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
      context.getLogger().debug("mcp", "Tool get_resource called", { id });
      const resource = await context.getAppService().getResource(id);
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
      context.getLogger().debug("mcp", "Tool list_resources called");
      const resources = await context.getAppService().listResources();
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
      context.getLogger().info("mcp", "Tool update_resource called", { id });
      const resource = await context.getAppService().updateResource({ id, name, contentMd });

      return {
        content: textContent("Ресурс обновлен."),
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
      context.getLogger().debug("mcp", "Tool find_resources called", { query });
      const resources = await context.getAppService().listResources();
      const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
      const matches = resources
        .filter((resource) =>
          [resource.id, resource.name, resource.contentMd]
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
}
