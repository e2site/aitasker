/*
Назначение: Композирует верхнеуровневый renderer-интерфейс и переключает страницы задач и ресурсов.
Не входит: Настройка провайдеров и низкоуровневое монтирование DOM.
*/
import { useAtomValue } from "jotai";
import { HomePage } from "@/renderer/pages/home-page";
import { ResourcesPage } from "@/renderer/pages/resources-page";
import { currentPageAtom } from "@/renderer/features/navigation/current-page-state";

export function App() {
  const page = useAtomValue(currentPageAtom);

  return (
    <>
      <div className={page === "tasks" ? "flex min-h-0 flex-1 overflow-y-auto" : "hidden"}>
        <HomePage />
      </div>
      <div className={page === "resources" ? "flex min-h-0 flex-1 overflow-y-auto" : "hidden"}>
        <ResourcesPage />
      </div>
    </>
  );
}
