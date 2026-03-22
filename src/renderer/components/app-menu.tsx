/*
Назначение: Отрисовывает верхнее меню приложения с переключением между разделами задач и ресурсов.
Не входит: Контент страниц, загрузка данных и управление глобальными провайдерами.
*/
import type { ReactNode } from "react";
import { BookOpen, CheckSquare } from "lucide-react";
import { useAppMenuTaskActions } from "@/renderer/app/app-menu-actions-context";
import { APP_THEME } from "@/renderer/app/theme";
import { cn } from "@/renderer/components/ui/class-names";
import { TaskTableTopBarProjectControls } from "@/renderer/components/task-table-top-bar-project-controls";

export type AppMenuPage = "tasks" | "resources";

export interface AppMenuProps {
  activePage: AppMenuPage;
  onChangePage(page: AppMenuPage): void;
}

interface AppMenuItemProps {
  icon: ReactNode;
  isActive: boolean;
  isLeftOfActive: boolean;
  isRightOfActive: boolean;
  isFirst: boolean;
  isLast: boolean;
  label: string;
  onClick(): void;
}

function AppMenuItem({ icon, isActive, isLeftOfActive, isRightOfActive, isFirst, isLast, label, onClick }: AppMenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative mb-[8px] flex items-center gap-1.5 px-[80px] py-[13px] font-medium transition",
        isActive ? "rounded-t-xl rounded-b-none z-20" : "z-10",
        !isActive && isFirst ? "rounded-tl-xl" : "",
        !isActive && isLast ? "rounded-tr-xl" : ""
      )}
      style={{
        backgroundColor: isActive
          ? APP_THEME.menuItemActiveBackground
          : APP_THEME.menuItemInactiveBackground,
        color: isActive ? APP_THEME.menuItemActiveText : APP_THEME.menuItemInactiveText,
        fontSize: 22,
        marginRight: isLeftOfActive ? -10 : 0,
        marginLeft: isRightOfActive ? -10 : 0
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export function AppMenu({ activePage, onChangePage }: AppMenuProps) {
  const taskActions = useAppMenuTaskActions();
  const pages: { key: AppMenuPage; icon: ReactNode; label: string }[] = [
    { key: "tasks", icon: <CheckSquare className="size-4" />, label: "Задачи" },
    { key: "resources", icon: <BookOpen className="size-4" />, label: "Ресурсы" }
  ];

  const activeIndex = pages.findIndex((page) => page.key === activePage);

  return (
    <nav className="flex h-[80px] items-end gap-0 border-b border-slate-200 px-5 md:px-6" style={{ backgroundColor: APP_THEME.menuPanelBackground }}>
      {pages.map((page, index) => (
        <AppMenuItem
          key={page.key}
          icon={page.icon}
          isActive={page.key === activePage}
          isLeftOfActive={index === activeIndex - 1}
          isRightOfActive={index === activeIndex + 1}
          isFirst={index === 0}
          isLast={index === pages.length - 1}
          label={page.label}
          onClick={() => onChangePage(page.key)}
        />
      ))}
      <div className="mb-[8px] ml-auto flex items-center gap-2">
        {taskActions ? (
          <TaskTableTopBarProjectControls
            isExportingData={taskActions.isExportingData}
            isImportingData={taskActions.isImportingData}
            onCopyAgentPrompt={taskActions.onCopyAgentPrompt}
            onOpenCreateModal={taskActions.onOpenCreateModal}
            onOpenPromptOverrides={taskActions.onOpenPromptOverrides}
            onExportData={taskActions.onExportData}
            onImportData={taskActions.onImportData}
          />
        ) : null}
      </div>
    </nav>
  );
}
