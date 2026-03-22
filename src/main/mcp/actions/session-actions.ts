/*
Назначение: Регистрирует MCP-экшены состояния агентской сессии.
Не входит: Операции с проектами, задачами, планами, ресурсами и prompt-ами.
*/
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { serializeAgentSession } from "../mcp-response-presenters";
import { textContent, type McpControllerContext } from "../controller/mcp-controller-context";

export function registerSessionActions(server: McpServer, context: McpControllerContext) {
  server.registerTool(
    "get_session_state",
    {
      description:
        "Получить текущее состояние MCP-сессии: над какой задачей работает агент, насколько свеж контекст и сколько шагов уже сделано. Используй перед началом работы с задачей, чтобы понять, нужно ли перечитывать контекст."
    },
    async () => {
      context.getLogger().debug("mcp", "Tool get_session_state called");
      const response = serializeAgentSession(context.getAgentSession());

      return {
        content: textContent(JSON.stringify(response, null, 2)),
        structuredContent: response
      };
    }
  );
}
