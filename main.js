// Purpose: Provide the root Electron entry file that bootstraps the bundled main-process build with Electron APIs.
// Out of scope: Main-process business logic and renderer initialization.
import { BrowserWindow, app, ipcMain } from "electron/main";
import { bootstrapMainProcess } from "./dist-electron/main/index.js";

bootstrapMainProcess({ BrowserWindow, app, ipcMain });
