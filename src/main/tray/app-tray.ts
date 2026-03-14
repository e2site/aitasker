/*
Назначение: Создаёт иконку приложения в системном трее с контекстным меню и скрытием окна вместо закрытия.
Не входит: Отправка уведомлений и IPC-каналы.
*/
import { App, BrowserWindow, Menu, nativeImage, Tray } from "electron";

// Minimal 16x16 blue PNG (solid #3b82f6)
const TRAY_ICON_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAH0lEQVQ4T2" +
  "NkYGD4z8BAAhgHjIJRMApGwSgYBQAACgABBOJFYgAAAABJRU5ErkJggg==";

export function createAppTray(getWindow: () => BrowserWindow | null, app: App): Tray {
  const icon = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL);
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
