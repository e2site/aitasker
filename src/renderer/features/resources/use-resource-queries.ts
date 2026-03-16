/*
Назначение: React Query хуки для чтения списка ресурсов и детали конкретного ресурса через preload API.
Не входит: UI-компоненты и мутации (create, update, delete, link).
*/
import { useQuery } from "@tanstack/react-query";

export function useResourcesQuery() {
  return useQuery({
    queryKey: ["resources"],
    queryFn: () => window.desktop.listResources()
  });
}

export function useResourceQuery(id: string | null) {
  return useQuery({
    queryKey: ["resource", id],
    queryFn: () => window.desktop.getResource(id as string),
    enabled: Boolean(id)
  });
}
