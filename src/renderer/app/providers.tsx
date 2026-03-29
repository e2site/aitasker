/*
Назначение: Оборачивает renderer-дерево общими провайдерами и подпиской на обновления данных из main process.
Не входит: Page layout, определения форм и реализация preload API.
*/
import { PropsWithChildren } from "react";
import { Provider as JotaiProvider } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DesktopDataSync } from "@/renderer/app/desktop-data-sync";
import { ThemeSync } from "@/renderer/features/theme/theme-sync";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false
    }
  }
});

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <JotaiProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ThemeSync />
          <DesktopDataSync />
          {children}
        </TooltipProvider>
      </QueryClientProvider>
    </JotaiProvider>
  );
}
