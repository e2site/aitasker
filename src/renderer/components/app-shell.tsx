/*
Назначение: Предоставляет общий layout renderer-приложения без вспомогательной верхней панели.
Не входит: Feature-специфичные виджеты и логика загрузки данных.
*/
import type { PropsWithChildren } from "react";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen">
      <main className="app-surface">
        <div className="app-grid">{children}</div>
      </main>
    </div>
  );
}
