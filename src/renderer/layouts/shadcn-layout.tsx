/*
Назначение: Собирает shadcn-layout приложения с sidebar-провайдером, верхним header с хлебными крошками и основным renderer-контентом.
Не входит: Логика breadcrumb-навигации, содержимое sidebar и реализация страниц приложения.
*/
import * as React from "react";
import { AppBreadcrumbsHeader } from "@/renderer/components/app-breadcrumbs-header";
import { AppSidebar } from "@/renderer/components/app-sidebar";
import { AppDrawer } from "@/renderer/components/app-drawer";
import { App } from "@/renderer/app/App";
import { AppMenuActionsProvider } from "@/renderer/app/app-menu-actions-context";
import {
  SidebarInset,
  SidebarProvider,
} from "@/renderer/components/ui/sidebar";

export default function ShadcnLayout() {
  return (
    <AppMenuActionsProvider>
      <SidebarProvider
        className="flex-1"
        style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
      >
        <AppSidebar />
        <SidebarInset className="relative overflow-hidden">
          <AppBreadcrumbsHeader />
          <AppDrawer />
          <App />
        </SidebarInset>
      </SidebarProvider>
    </AppMenuActionsProvider>
  );
}
