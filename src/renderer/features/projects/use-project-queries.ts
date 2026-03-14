/*
Назначение: Дает React Query hooks для чтения списка проектов через preload API.
Не входит: Отрисовка переключателя проектов и локальное UI-состояние.
*/
import { useQuery } from "@tanstack/react-query";

export function useProjectsQuery() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => window.desktop.listProjects()
  });
}
