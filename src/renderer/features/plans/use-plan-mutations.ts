/*
Назначение: Дает React Query hooks для сохранения планов, расширений, доработок и восстановления ревизий через preload API.
Не входит: Интерфейс редактора, markdown-рендеринг и состояние выбора задачи.
*/
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  AnswerPlanQuestionInput,
  AppendPlanExtensionInput,
  AppendPlanImprovementInput,
  RestorePlanRevisionInput,
  SavePlanInput
} from "@/shared/contracts/desktop-api";

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

export function useAnswerPlanQuestionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AnswerPlanQuestionInput) => window.desktop.answerPlanQuestion(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["task-detail"] });
    }
  });
}

export function useAppendPlanExtensionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AppendPlanExtensionInput) => window.desktop.appendPlanExtension(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["task-detail"] });
    }
  });
}

export function useAppendPlanImprovementMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AppendPlanImprovementInput) => window.desktop.appendPlanImprovement(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["task-detail"] });
    }
  });
}

export function useRestorePlanRevisionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RestorePlanRevisionInput) => window.desktop.restorePlanRevision(input),
    onSuccess: async (detail) => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.setQueryData(["task-detail", detail.task.id], detail);
    }
  });
}
