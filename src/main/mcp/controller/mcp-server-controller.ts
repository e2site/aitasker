/*
Назначение: Реализует MCP-контроллер и централизованно подключает все action-модули сервера.
Не входит: Создание экземпляра McpServer и конфигурация его базовых capabilities.
*/
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerHintActions } from "../actions/hint-actions";
import { registerPlanActions } from "../actions/plan-actions";
import { registerProjectActions } from "../actions/project-actions";
import { registerPromptActions } from "../actions/prompt-actions";
import { registerResourceActions } from "../actions/resource-actions";
import { registerResourceTemplateActions } from "../actions/resource-template-actions";
import { registerSessionActions } from "../actions/session-actions";
import { registerTaskActions } from "../actions/task-actions";
import { McpControllerContext } from "./mcp-controller-context";
import type { AppService } from "../../services/app-service";
import type { DevLogger } from "../../services/dev-logger";

export class McpServerController {
  private readonly context: McpControllerContext;

  constructor(
    private readonly server: McpServer,
    appService: AppService,
    logger: DevLogger
  ) {
    this.context = new McpControllerContext(appService, logger);
  }

  register() {
    registerProjectActions(this.server, this.context);
    registerHintActions(this.server, this.context);
    registerTaskActions(this.server, this.context);
    registerPlanActions(this.server, this.context);
    registerResourceActions(this.server, this.context);
    registerSessionActions(this.server, this.context);
    registerPromptActions(this.server);
    registerResourceTemplateActions(this.server, this.context);
  }
}
