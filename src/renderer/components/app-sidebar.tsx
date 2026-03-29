import * as React from "react";
import { useAtom } from "jotai";
import {
  BookOpen,
  CheckSquare,
  Copy,
  Download,
  FolderPlus,
  Moon,
  Plus,
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
import { currentPageAtom, type AppPage } from "@/renderer/features/navigation/current-page-state";
import { drawerPageAtom } from "@/renderer/features/navigation/drawer-state";
import { useAppMenuTaskActions } from "@/renderer/app/app-menu-actions-context";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: projects = [] } = useProjectsQuery();
  const [selectedProjectId, setSelectedProjectId] = useAtom(selectedProjectIdAtom);
  const [currentPage, setCurrentPage] = useAtom(currentPageAtom);
  const [, setDrawerPage] = useAtom(drawerPageAtom);
  const [theme, setTheme] = useAtom(themeAtom);
  const taskActions = useAppMenuTaskActions();

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
