/*
Назначение: Оборачивает renderer-дерево общими провайдерами и подпиской на обновления данных из main process.
Не входит: Page layout, определения форм и реализация preload API.
*/
import { PropsWithChildren } from "react";
import { Provider as JotaiProvider } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DesktopDataSync } from "@/renderer/app/desktop-data-sync";

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
        <DesktopDataSync />
        {children}
      </QueryClientProvider>
    </JotaiProvider>
  );
}
