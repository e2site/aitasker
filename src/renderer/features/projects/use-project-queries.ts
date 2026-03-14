/*
Назначение: Дает React Query hooks для чтения списка проектов через preload API.
Не входит: Отрисовка переключателя проектов и локальное UI-состояние.
*/
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateProjectInput, UpdateProjectProfileInput } from "@/shared/contracts/desktop-api";

export function useProjectsQuery() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => window.desktop.listProjects()
  });
}

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => window.desktop.createProject(input),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    }
  });
}

export function useUpdateProjectProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProjectProfileInput) => window.desktop.updateProjectProfile(input),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void queryClient.invalidateQueries({ queryKey: ["task-detail"] });
    }
  });
}
