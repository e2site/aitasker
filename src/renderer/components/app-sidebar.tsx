/*
Назначение: Отрисовывает боковое меню приложения и переключает основные страницы, drawer-экраны и тему.
Не входит: Контент страниц, загрузка детальных данных задач и реализация drawer-форм.
*/
import * as React from "react";
import { useAtom } from "jotai";
import {
  BookOpen,
  CheckSquare,
  Copy,
  Download,
  FolderPlus,
  Lightbulb,
  Loader2,
  Moon,
  Plus,
  RefreshCw,
  Settings2,
  SlidersHorizontal,
  Sun,
  Upload,
} from "lucide-react";
import { ProjectSwitcher } from "@/components/project-switcher";
import { themeAtom } from "@/renderer/features/theme/theme-state";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/renderer/components/ui/sidebar";
import { useProjectsQuery } from "@/renderer/features/projects/use-project-queries";
import { selectedProjectIdAtom } from "@/renderer/features/projects/selected-project-id-state";
import { currentPageAtom } from "@/renderer/features/navigation/current-page-state";
import { drawerPageAtom } from "@/renderer/features/navigation/drawer-state";
import { useAppMenuTaskActions } from "@/renderer/app/app-menu-actions-context";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: projects = [] } = useProjectsQuery();
  const [selectedProjectId, setSelectedProjectId] = useAtom(selectedProjectIdAtom);
  const [currentPage, setCurrentPage] = useAtom(currentPageAtom);
  const [, setDrawerPage] = useAtom(drawerPageAtom);
  const [theme, setTheme] = useAtom(themeAtom);
  const taskActions = useAppMenuTaskActions();
  const [isReindexing, setIsReindexing] = React.useState(false);

  async function handleReindexPromptHints() {
    if (isReindexing) return;
    if (!window.confirm("Переиндексация может занять минуты. Продолжить?")) return;

    setIsReindexing(true);
    try {
      const result = await window.desktop.reindexPromptHints();
      const total = result.ok + result.failed.length;

      if (result.failed.length === 0) {
        window.alert(`Переиндексация завершена. Обновлено подсказок: ${result.ok}.`);
        return;
      }

      const sample = result.failed
        .slice(0, 5)
        .map((failure) => `• ${failure.hintId}: ${failure.message}`)
        .join("\n");
      const tail = result.failed.length > 5 ? `\n…и ещё ${result.failed.length - 5}.` : "";
      window.alert(
        `Переиндексация завершена с ошибками.\nОбновлено: ${result.ok} из ${total}.\nОшибок: ${result.failed.length}.\n\n${sample}${tail}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      window.alert(`Не удалось запустить переиндексацию: ${message}`);
    } finally {
      setIsReindexing(false);
    }
  }

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <ProjectSwitcher
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSelectProject={setSelectedProjectId}
        />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => setDrawerPage("create-project")}>
              <FolderPlus />
              Новый проект
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Проект */}
        <SidebarGroup>
          <SidebarGroupLabel>Проект</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={currentPage === "tasks"}
                  onClick={() => setCurrentPage("tasks")}
                >
                  <CheckSquare />
                  Задачи
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setDrawerPage("create-task")}>
                  <Plus />
                  Создать задачу
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={taskActions?.onCopyAgentPrompt}
                  disabled={!taskActions}
                >
                  <Copy />
                  Создать задачу в агенте
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={currentPage === "project-hints"}
                  onClick={() => setCurrentPage("project-hints")}
                >
                  <Lightbulb />
                  Подсказки
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setDrawerPage("project-settings")}>
                  <Settings2 />
                  Настройки проекта
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Общее */}
        <SidebarGroup>
          <SidebarGroupLabel>Общее</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={currentPage === "resources"}
                  onClick={() => setCurrentPage("resources")}
                >
                  <BookOpen />
                  Ресурсы
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Настройки — прижаты к низу */}
      <SidebarFooter>
        <SidebarGroup>
          <SidebarGroupLabel>Настройки</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setDrawerPage("prompt-overrides")}>
                  <SlidersHorizontal />
                  Настройки промтов
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleReindexPromptHints} disabled={isReindexing}>
                  {isReindexing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                  {isReindexing ? "Переиндексация..." : "Переиндексировать векторы"}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
                  {theme === "light" ? <Moon /> : <Sun />}
                  {theme === "light" ? "Тёмная тема" : "Светлая тема"}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={taskActions?.onExportData}
                  disabled={!taskActions || taskActions.isExportingData}
                >
                  <Download />
                  {taskActions?.isExportingData ? "Сохранение..." : "Сохранить данные"}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={taskActions?.onImportData}
                  disabled={!taskActions || taskActions.isImportingData}
                >
                  <Upload />
                  {taskActions?.isImportingData ? "Загрузка..." : "Загрузить данные"}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
