/*
Назначение: Запускает main process Electron, инициализирует локальные сервисы данных и поднимает MCP-сервер.
Не входит: Получение Electron API, описание схемы базы и реализация renderer-интерфейса.
*/
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAgentRegistry } from "./agents/agent-registry";
import { AgentSessionRepository } from "./db/agent-session-repository";
import { createAppDatabase } from "./db/database";
import { PlanRepository } from "./db/plan-repository";
import { ProjectRepository } from "./db/project-repository";
import { TaskRepository } from "./db/task-repository";
import { createAppService } from "./services/app-service";
import type { AppService } from "./services/app-service";
import { createDevLogger } from "./services/dev-logger";
import { registerIpcHandlers } from "./ipc/register-ipc-handlers";
import { McpHttpServer } from "./mcp/mcp-http-server";
import type { App, BrowserWindow as BrowserWindowType, IpcMain } from "electron";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(CURRENT_DIR, "..", "..");
const RENDERER_DIST = join(APP_ROOT, "dist");
const PRELOAD_SCRIPT = join(APP_ROOT, "preload.js");
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

export interface MainProcessRuntime {
  BrowserWindow: typeof BrowserWindowType;
  app: App;
  ipcMain: IpcMain;
}

let mainWindow: BrowserWindowType | null = null;

async function createMainWindow(runtime: MainProcessRuntime): Promise<void> {
  mainWindow = new runtime.BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    show: false,
    title: "AITasker",
    webPreferences: {
      preload: PRELOAD_SCRIPT,
      contextIsolation: true,
      sandbox: false
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  if (VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  await mainWindow.loadFile(join(RENDERER_DIST, "index.html"));
}

export function bootstrapMainProcess(runtime: MainProcessRuntime): void {
  runtime.app.whenReady().then(async () => {
    const databaseContext = createAppDatabase(runtime.app.getPath("userData"));
    const logger = createDevLogger();
    const taskRepository = new TaskRepository(databaseContext.database);
    const planRepository = new PlanRepository(databaseContext.database);
    const projectRepository = new ProjectRepository(databaseContext.database);
    const agentSessionRepository = new AgentSessionRepository(databaseContext.database);
    const agentRegistry = createAgentRegistry();
    let appService!: AppService;
    let mcpHttpServer: McpHttpServer | null = null;

    appService = createAppService({
      agentProviders: agentRegistry.providers,
      agentSessionRepository,
      databasePath: databaseContext.databasePath,
      getMcpEndpoint: () => mcpHttpServer?.endpoint ?? null,
      isMcpRunning: () => mcpHttpServer?.isRunning ?? false,
      planRepository,
      platform: process.platform,
      projectRepository,
      taskRepository
    });
    mcpHttpServer = new McpHttpServer(appService, logger);

    await mcpHttpServer.start();
    logger.info("app", "Main process initialized", {
      databasePath: databaseContext.databasePath,
      mcpEndpoint: mcpHttpServer.endpoint
    });

    registerIpcHandlers(runtime.ipcMain, appService);
    await createMainWindow(runtime);

    runtime.app.on("activate", async () => {
      if (runtime.BrowserWindow.getAllWindows().length === 0) {
        await createMainWindow(runtime);
      }
    });

    runtime.app.once("before-quit", async () => {
      await mcpHttpServer?.stop();
    });
  });

  runtime.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      runtime.app.quit();
    }
  });
}
