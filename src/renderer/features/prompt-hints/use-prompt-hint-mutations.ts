/*
Назначение: React Query мутации для создания, редактирования и удаления подсказок проекта через preload API.
Не входит: UI-компоненты, чтение списков и локальное состояние выбранной подсказки.
*/
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CreatePromptHintInput,
  DeletePromptHintInput,
  UpdatePromptHintInput
} from "@/shared/contracts/desktop-api";

function useInvalidatePromptHints() {
  const queryClient = useQueryClient();

  return async (projectId: string) => {
    await queryClient.invalidateQueries({ queryKey: ["prompt-hints", projectId] });
  };
}

export function useCreatePromptHintMutation() {
  const invalidatePromptHints = useInvalidatePromptHints();

  return useMutation({
    mutationFn: (input: CreatePromptHintInput) => window.desktop.createPromptHint(input),
    onSuccess: async (hint) => {
      await invalidatePromptHints(hint.projectId);
    }
  });
}

export function useUpdatePromptHintMutation() {
  const invalidatePromptHints = useInvalidatePromptHints();

  return useMutation({
    mutationFn: (input: UpdatePromptHintInput) => window.desktop.updatePromptHint(input),
    onSuccess: async (hint) => {
      await invalidatePromptHints(hint.projectId);
    }
  });
}

export function useDeletePromptHintMutation() {
  const invalidatePromptHints = useInvalidatePromptHints();

  return useMutation({
    mutationFn: (input: DeletePromptHintInput) => window.desktop.deletePromptHint(input),
    onSuccess: async (_deleted, input) => {
      await invalidatePromptHints(input.projectId);
    }
  });
}
