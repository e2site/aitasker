/*
Назначение: Создает и настраивает MCP-сервер AITasker через контроллер, который регистрирует action-модули.
Не входит: HTTP-хостинг, жизненный цикл Electron-окна и прямое создание файлов внешними агентами.
*/
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpServerController } from "./controller/mcp-server-controller";
import type { AppService } from "../services/app-service";
import type { DevLogger } from "../services/dev-logger";

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

  const controller = new McpServerController(server, appService, logger);
  controller.register();

  return server;
}
