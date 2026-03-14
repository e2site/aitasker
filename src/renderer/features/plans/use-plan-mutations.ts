/*
Purpose: Provide React Query hooks for saving plans and appending plan notes through the preload API.
Out of scope: Editor UI, markdown rendering, and task selection state.
*/
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AppendPlanNoteInput, SavePlanInput } from "@/shared/contracts/desktop-api";

export function useSavePlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SavePlanInput) => window.desktop.savePlan(input),
    onSuccess: async (detail) => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.setQueryData(["task-detail", detail.task.id], detail);
    }
  });
}

export function useAppendPlanNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AppendPlanNoteInput) => window.desktop.appendPlanNote(input),
    onSuccess: async (detail) => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.setQueryData(["task-detail", detail.task.id], detail);
    }
  });
}
