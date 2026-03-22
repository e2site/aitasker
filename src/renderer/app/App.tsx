/*
Назначение: Композирует верхнеуровневый renderer-интерфейс и переключает страницы задач и ресурсов.
Не входит: Настройка провайдеров и низкоуровневое монтирование DOM.
*/
import { useState } from "react";
import { AppMenuActionsProvider } from "@/renderer/app/app-menu-actions-context";
import { HomePage } from "@/renderer/pages/home-page";
import { ResourcesPage } from "@/renderer/pages/resources-page";
import { AppMenu, type AppMenuPage } from "@/renderer/components/app-menu";

export function App() {
  const [page, setPage] = useState<AppMenuPage>("tasks");

  return (
    <AppMenuActionsProvider>
      <div className="flex min-h-screen flex-col">
        <AppMenu activePage={page} onChangePage={setPage} />
        <div className={page === "tasks" ? "block" : "hidden"}>
          <HomePage />
        </div>
        <div className={page === "resources" ? "block" : "hidden"}>
          <ResourcesPage />
        </div>
      </div>
    </AppMenuActionsProvider>
  );
}
