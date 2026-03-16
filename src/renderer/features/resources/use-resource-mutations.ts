/*
Назначение: React Query мутации для создания, обновления, удаления ресурсов и управления привязками к задачам.
Не входит: UI-компоненты и запросы данных.
*/
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CreateResourceInput,
  LinkResourceInput,
  UnlinkResourceInput,
  UpdateResourceInput
} from "@/shared/contracts/desktop-api";

export function useCreateResourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateResourceInput) => window.desktop.createResource(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["resources"] });
    }
  });
}

export function useUpdateResourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateResourceInput) => window.desktop.updateResource(input),
    onSuccess: async (resource) => {
      await queryClient.invalidateQueries({ queryKey: ["resources"] });
      queryClient.setQueryData(["resource", resource.id], resource);
    }
  });
}

export function useDeleteResourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => window.desktop.deleteResource(id),
    onSuccess: async (_result, id) => {
      await queryClient.invalidateQueries({ queryKey: ["resources"] });
      queryClient.removeQueries({ queryKey: ["resource", id], exact: true });
    }
  });
}

export function useLinkResourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LinkResourceInput) => window.desktop.linkResource(input),
    onSuccess: async (detail) => {
      queryClient.setQueryData(["task-detail", detail.task.id], detail);
    }
  });
}

export function useUnlinkResourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UnlinkResourceInput) => window.desktop.unlinkResource(input),
    onSuccess: async (detail) => {
      queryClient.setQueryData(["task-detail", detail.task.id], detail);
    }
  });
}
