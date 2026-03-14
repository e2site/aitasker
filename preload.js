// Purpose: Provide the root preload entry file that wires Electron renderer APIs into the bundled preload logic.
// Out of scope: Renderer business logic and main-process orchestration.
import { contextBridge, ipcRenderer } from "electron/renderer";
import { registerDesktopApi } from "./dist-electron/preload/index.js";

registerDesktopApi({ contextBridge, ipcRenderer });
