/*
Назначение: React Query хуки для чтения, сохранения и удаления переопределений промтов через preload API.
Не входит: Рендеринг компонентов и логика шаблонов.
*/
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DeletePromptOverrideInput, UpsertPromptOverrideInput } from "@/shared/contracts/desktop-api";

export function usePromptOverridesQuery() {
  return useQuery({
    queryKey: ["prompt-overrides"],
    queryFn: () => window.desktop.listPromptOverrides()
  });
}

export function useUpsertPromptOverrideMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpsertPromptOverrideInput) => window.desktop.upsertPromptOverride(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["prompt-overrides"] });
    }
  });
}

export function useDeletePromptOverrideMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: DeletePromptOverrideInput) => window.desktop.deletePromptOverride(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["prompt-overrides"] });
    }
  });
}
