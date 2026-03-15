/*
Назначение: Запускает main process Electron, инициализирует локальные сервисы данных, отключает стандартное меню и поднимает MCP-сервер.
Не входит: Получение Electron API, описание схемы базы и реализация renderer-интерфейса.
*/
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAgentRegistry } from "./agents/agent-registry";
import { AgentSessionRepository } from "./db/agent-session-repository";
import { createAppDatabase } from "./db/database";
import { PlanRepository } from "./db/plan-repository";
import { ProjectRepository } from "./db/project-repository";
import { PromptOverrideRepository } from "./db/prompt-override-repository";
import { TaskLinkRepository } from "./db/task-link-repository";
import { TaskRepository } from "./db/task-repository";
import { createAppService } from "./services/app-service";
import type { AppService } from "./services/app-service";
import { createDevLogger } from "./services/dev-logger";
import { registerIpcHandlers } from "./ipc/register-ipc-handlers";
import { McpHttpServer } from "./mcp/mcp-http-server";
import { getWindowIconPath } from "./assets/app-icon-paths";
import { createAppTray, setupWindowHideOnClose } from "./tray/app-tray";
import { Menu } from "electron";
import type { App, BrowserWindow as BrowserWindowType, IpcMain } from "electron";
import type { DesktopDataChangeEvent } from "../shared/contracts/desktop-api";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(CURRENT_DIR, "..", "..");
const RENDERER_DIST = join(APP_ROOT, "dist");
const PRELOAD_SCRIPT = join(APP_ROOT, "preload.js");
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const DATA_CHANGED_CHANNEL = "app:data-changed";
const FOCUS_TASK_CHANNEL = "app:focus-task";

const NOTIFY_REASONS = new Set<DesktopDataChangeEvent["reason"]>([
  "update-task-status",
  "save-plan",
  "create-task",
  "append-plan-extension",
  "append-plan-improvement"
]);

const REASON_LABELS: Partial<Record<DesktopDataChangeEvent["reason"], string>> = {
  "update-task-status": "Статус задачи изменён",
  "save-plan": "План обновлён",
  "create-task": "Задача создана",
  "append-plan-extension": "Добавлено расширение плана",
  "append-plan-improvement": "Добавлена доработка плана"
};

async function sendTaskNotification(
  event: DesktopDataChangeEvent,
  getWindow: () => BrowserWindowType | null
): Promise<void> {
  if (!NOTIFY_REASONS.has(event.reason)) return;

  const { Notification } = await import("electron");
  if (!Notification.isSupported()) return;

  const label = REASON_LABELS[event.reason] ?? event.reason;
  const taskSuffix = event.taskId ? ` · ${event.taskId.slice(0, 8).toUpperCase()}` : "";

  const notification = new Notification({
    title: "AITasker",
    body: label + taskSuffix,
    silent: true
  });

  notification.on("click", () => {
    const win = getWindow();
    if (!win) return;
    win.show();
    win.focus();
    if (event.taskId) {
      win.webContents.send(FOCUS_TASK_CHANNEL, event.taskId);
    }
  });

  notification.show();
}

export interface MainProcessRuntime {
  BrowserWindow: typeof BrowserWindowType;
  app: App;
  ipcMain: IpcMain;
}

let mainWindow: BrowserWindowType | null = null;

async function createMainWindow(runtime: MainProcessRuntime): Promise<void> {
  const windowIconPath = getWindowIconPath(runtime.app);

  mainWindow = new runtime.BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    show: false,
    title: "AITasker",
    icon: windowIconPath,
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
    Menu.setApplicationMenu(null);
    const databaseContext = createAppDatabase(runtime.app.getPath("userData"));
    const logger = createDevLogger();
    const taskRepository = new TaskRepository(databaseContext.database);
    const taskLinkRepository = new TaskLinkRepository(databaseContext.database);
    const planRepository = new PlanRepository(databaseContext.database);
    const projectRepository = new ProjectRepository(databaseContext.database);
    const promptOverrideRepository = new PromptOverrideRepository(databaseContext.database);
    const agentSessionRepository = new AgentSessionRepository(databaseContext.database);
    const agentRegistry = createAgentRegistry();
    let appService!: AppService;
    let mcpHttpServer: McpHttpServer | null = null;
    let isShuttingDown = false;

    const shutdownApp = async () => {
      if (isShuttingDown) {
        return;
      }

      isShuttingDown = true;

      try {
        await mcpHttpServer?.stop();
      } catch (error) {
        logger.error("app", "Failed to stop MCP server during shutdown", {
          error: error instanceof Error ? error.message : String(error)
        });
      } finally {
        runtime.app.exit(0);
      }
    };

    appService = createAppService({
      agentProviders: agentRegistry.providers,
      agentSessionRepository,
      databasePath: databaseContext.databasePath,
      getMcpEndpoint: () => mcpHttpServer?.endpoint ?? null,
      isMcpRunning: () => mcpHttpServer?.isRunning ?? false,
      onDataChanged: (event) => {
        for (const window of runtime.BrowserWindow.getAllWindows()) {
          window.webContents.send(DATA_CHANGED_CHANNEL, event);
        }
        void sendTaskNotification(event, () => mainWindow);
      },
      planRepository,
      platform: process.platform,
      projectRepository,
      promptOverrideRepository,
      relaunchApp: () => {
        runtime.app.relaunch();
        runtime.app.exit(0);
      },
      sqlite: databaseContext.sqlite,
      taskLinkRepository,
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

    // Tray icon
    createAppTray(() => mainWindow, runtime.app, shutdownApp);

    // Hide to tray instead of closing (non-macOS)
    if (mainWindow) {
      setupWindowHideOnClose(mainWindow, process.platform, runtime.app);
    }

    runtime.app.on("activate", async () => {
      if (runtime.BrowserWindow.getAllWindows().length === 0) {
        await createMainWindow(runtime);
      }
    });

    runtime.app.on("before-quit", (event) => {
      if (isShuttingDown) {
        return;
      }

      event.preventDefault();
      void shutdownApp();
    });
  });

  runtime.app.on("window-all-closed", () => {
    // On non-macOS, window closing hides to tray — quit only via tray menu
    if (process.platform === "darwin") {
      runtime.app.quit();
    }
  });
}
