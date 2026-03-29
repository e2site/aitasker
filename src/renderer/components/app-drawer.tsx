/*
Назначение: Drawer поверх SidebarInset — открывается от левого края контента (не от края экрана).
Не входит: Логика страниц, загрузка данных.
*/
import { useAtom } from "jotai";
import { X } from "lucide-react";
import { drawerPageAtom, type DrawerPage } from "@/renderer/features/navigation/drawer-state";
import { CreateTaskPage } from "@/renderer/pages/create-task-page";
import { CreateProjectPage } from "@/renderer/pages/create-project-page";
import { ProjectSettingsPage } from "@/renderer/pages/project-settings-page";
import { PromptOverridesPage } from "@/renderer/pages/prompt-overrides-page";

const DRAWER_TITLES: Record<Exclude<DrawerPage, null>, string> = {
  "create-task": "Новая задача",
  "create-project": "Новый проект",
  "prompt-overrides": "Настройки промтов",
  "project-settings": "Настройки проекта",
};

export function AppDrawer() {
  const [drawerPage, setDrawerPage] = useAtom(drawerPageAtom);
  const isOpen = drawerPage !== null;

  function close() {
    setDrawerPage(null);
  }

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="absolute inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
          onClick={close}
        />
      )}

      {/* Drawer panel */}
      <div
        className="absolute inset-y-0 left-0 z-50 flex w-[80%] max-w-none flex-col bg-background shadow-2xl transition-transform duration-300 ease-in-out"
        style={{
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-5">
          <span className="text-base font-semibold">
            {drawerPage ? DRAWER_TITLES[drawerPage] : ""}
          </span>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {drawerPage === "create-task" && <CreateTaskPage onClose={close} />}
          {drawerPage === "create-project" && <CreateProjectPage onClose={close} />}
          {drawerPage === "prompt-overrides" && <PromptOverridesPage />}
          {drawerPage === "project-settings" && <ProjectSettingsPage onClose={close} />}
        </div>
      </div>
    </>
  );
}
