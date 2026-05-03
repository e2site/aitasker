/*
Назначение: Подписывает renderer на push-обновления данных из main process и инвалидирует React Query кэш.
Не входит: Отрисовка интерфейса, preload-реализация и логика доменных мутаций.
*/
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function DesktopDataSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    return window.desktop.onDataChanged((event) => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });

      if (event.reason.includes("prompt-hint")) {
        void queryClient.invalidateQueries({ queryKey: ["prompt-hints"] });
      }

      if (event.taskId) {
        void queryClient.invalidateQueries({ queryKey: ["task-detail", event.taskId], exact: true });
        return;
      }

      void queryClient.invalidateQueries({ queryKey: ["task-detail"] });
    });
  }, [queryClient]);

  return null;
}
