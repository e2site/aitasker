/*
Назначение: Создаёт иконку приложения в системном трее с контекстным меню и скрытием окна вместо закрытия.
Не входит: Отправка уведомлений, IPC-каналы и определение путей к файловым иконкам.
*/
import { App, BrowserWindow, Menu, nativeImage, Tray } from "electron";
import { getTrayIconPath } from "../assets/app-icon-paths";

export function createAppTray(getWindow: () => BrowserWindow | null, app: App): Tray {
  const trayIconPath = getTrayIconPath(app);
  const icon = trayIconPath ? nativeImage.createFromPath(trayIconPath) : nativeImage.createEmpty();

  if (icon.isEmpty()) {
    throw new Error("Tray icon could not be loaded from build/icons/icon_tray.png or build/icons/icon.ico.");
  }

  const tray = new Tray(icon);
  tray.setToolTip("AITasker");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Открыть AITasker",
      click() {
        const win = getWindow();
        if (!win) return;
        win.show();
        win.focus();
      }
    },
    { type: "separator" },
    {
      label: "Выйти",
      click() {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    const win = getWindow();
    if (!win) return;
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
      win.focus();
    }
  });

  return tray;
}

export function setupWindowHideOnClose(win: BrowserWindow, platform: string, app: App): void {
  if (platform === "darwin") return;

  let isQuitting = false;
  app.on("before-quit", () => {
    isQuitting = true;
  });

  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
}
