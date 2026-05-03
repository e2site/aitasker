/*
Назначение: React Query хуки для чтения списка подсказок проекта и поиска по ним через preload API.
Не входит: UI-компоненты и мутации создания, редактирования и удаления подсказок.
*/
import { useQuery } from "@tanstack/react-query";

export function usePromptHintsQuery(projectId: string | null) {
  return useQuery({
    queryKey: ["prompt-hints", projectId, "list"],
    queryFn: () => window.desktop.listPromptHints({ projectId: projectId as string }),
    enabled: Boolean(projectId)
  });
}

export function usePromptHintSearchQuery(projectId: string | null, text: string, limit: number) {
  const normalizedText = text.trim();

  return useQuery({
    queryKey: ["prompt-hints", projectId, "search", normalizedText, limit],
    queryFn: () =>
      window.desktop.searchPromptHints({
        projectId: projectId as string,
        text: normalizedText,
        limit
      }),
    enabled: Boolean(projectId && normalizedText)
  });
}
