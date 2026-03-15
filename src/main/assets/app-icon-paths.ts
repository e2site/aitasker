/*
Назначение: Определяет пути к файловым иконкам Electron для окна приложения и системного трея в dev и packaged режимах.
Не входит: Создание BrowserWindow, создание Tray и конфигурация сборки electron-builder.
*/
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { App } from "electron";

function resolveIconPath(app: App, fileName: string): string | null {
  const candidates = [
    join(app.getAppPath(), "build", "icons", fileName),
    join(process.cwd(), "build", "icons", fileName),
    join(process.resourcesPath, "build", "icons", fileName),
    join(process.resourcesPath, "app.asar.unpacked", "build", "icons", fileName)
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export function getWindowIconPath(app: App): string | undefined {
  return resolveIconPath(app, "icon.ico") ?? undefined;
}

export function getTrayIconPath(app: App): string | undefined {
  return resolveIconPath(app, "icon_tray.png") ?? getWindowIconPath(app);
}
