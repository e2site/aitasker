/*
Назначение: Регистрирует MCP resource-template экшены для чтения task и plan через URI-схемы.
Не входит: Регистрация MCP-инструментов и prompt-ов.
*/
import { ResourceTemplate, type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { serializeTask } from "../mcp-response-presenters";
import { type McpControllerContext } from "../controller/mcp-controller-context";

export function registerResourceTemplateActions(server: McpServer, context: McpControllerContext) {
  server.registerResource(
    "task-resource",
    new ResourceTemplate("task://{id}", { list: undefined }),
    {
      description: "JSON задачи из активного подготовленного проекта"
    },
    async (uri, variables) => {
      const taskContext = await context.requireTaskContext(String(variables.id));
      const task = await taskContext.getTask();

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
      const taskContext = await context.requireTaskContext(String(variables.taskId));
      const plan = await taskContext.getPlan();

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
}
