/*
Назначение: Предоставляет общий layout renderer-приложения внутри контентной области под layout-header.
Не входит: Feature-специфичные виджеты и логика загрузки данных.
*/
import type { PropsWithChildren } from "react";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <main className="app-surface">
        <div className="app-grid">{children}</div>
      </main>
    </div>
  );
}
