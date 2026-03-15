/*
Назначение: React Query хуки для экспорта и импорта SQLite-базы приложения через preload API.
Не входит: UI-компоненты, навигация и работа с задачами/планами.
*/
import { useMutation } from "@tanstack/react-query";

export function useExportDataMutation() {
  return useMutation({
    mutationFn: () => window.desktop.exportData()
  });
}

export function useImportDataMutation() {
  return useMutation({
    mutationFn: () => window.desktop.importData()
  });
}
