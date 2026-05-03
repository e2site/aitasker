/*
Назначение: Регистрирует MCP-экшены подсказок активного проекта: массовое добавление и векторный поиск по нескольким ключевым запросам.
Не входит: CRUD UI, низкоуровневая работа SQLite/LanceDB и управление активным проектом.
*/
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  serializePromptHintCollection,
  serializePromptHintSearchCollection
} from "../mcp-response-presenters";
import { textContent, type McpControllerContext } from "../controller/mcp-controller-context";
import type { PromptHintRecord } from "../../../shared/contracts/desktop-api";

const DEFAULT_HINT_SEARCH_LIMIT = 8;

export function registerHintActions(server: McpServer, context: McpControllerContext) {
  server.registerTool(
    "add_project_hints",
    {
      description: "Сохранить важные инсайты по итогам задачи: грабли, скрытые зависимости, нюансы окружения. Только то, что пригодится в будущих задачах. Воду и очевидное не добавлять.",
      inputSchema: {
        hints: z.array(z.string().trim().min(1).max(8_000)).min(1).max(50)
      }
    },
    async ({ hints }) => {
      const project = await context.requireActiveProject();
      context.getLogger().info("mcp", "Tool add_project_hints called", {
        projectId: project.id,
        count: hints.length
      });

      const createdHints: PromptHintRecord[] = [];

      for (const hint of hints) {
        createdHints.push(
          await context.getAppService().createPromptHint({
            projectId: project.id,
            text: hint
          })
        );
      }

      const response = serializePromptHintCollection(createdHints, project);

      return {
        content: textContent(`Подсказки добавлены: ${createdHints.length}.`),
        structuredContent: response
      };
    }
  );

  server.registerTool(
    "search_project_hints",
    {
      description:
        "Найти ранее сохранённые инсайты по теме задачи. Если ничего релевантного не нашлось — игнорируй; подсказки могут не относиться к текущей задаче.",
      inputSchema: {
        keywords: z.array(z.string().trim().min(1).max(8_000)).min(1).max(20),
        limit: z.number().int().min(1).max(50).optional()
      }
    },
    async ({ keywords, limit }) => {
      const project = await context.requireActiveProject();
      const normalizedLimit = limit ?? DEFAULT_HINT_SEARCH_LIMIT;
      context.getLogger().debug("mcp", "Tool search_project_hints called", {
        projectId: project.id,
        keywordsCount: keywords.length,
        limit: normalizedLimit
      });

      const hints = await context.getAppService().searchPromptHintsByKeywords({
        projectId: project.id,
        keywords,
        limit: normalizedLimit
      });
      const response = serializePromptHintSearchCollection(hints, project, keywords);

      return {
        content: textContent(JSON.stringify(response, null, 2)),
        structuredContent: response
      };
    }
  );
}
