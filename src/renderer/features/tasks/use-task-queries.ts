/*
Назначение: Дает React Query hooks для чтения, создания и удаления задач через preload API.
Не входит: Отрисовка компонентов и локальное UI-состояние.
*/
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateTaskInput,
  LinkTaskInput,
  TaskRecord,
  UnlinkTaskInput,
  UpdateTaskInput,
  UpdateTaskStatusInput
} from "@/shared/contracts/desktop-api";

export function useTasksQuery() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: () => window.desktop.listTasks()
  });
}

export function useTaskDetailQuery(taskId: string | null) {
  return useQuery({
    queryKey: ["task-detail", taskId],
    queryFn: () => window.desktop.getTaskDetail(taskId as string),
    enabled: Boolean(taskId)
  });
}

export function useCreateTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTaskInput) => window.desktop.createTask(input),
    onSuccess: async (detail) => {
      queryClient.setQueryData<TaskRecord[]>(["tasks"], (previous = []) => {
        const nextTask = detail.task;
        const withoutCurrent = previous.filter((task) => task.id !== nextTask.id);
        return [nextTask, ...withoutCurrent];
      });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.setQueryData(["task-detail", detail.task.id], detail);
    }
  });
}

export function useDeleteTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => window.desktop.deleteTask(taskId),
    onSuccess: async ({ deletedTaskId }) => {
      queryClient.setQueryData<TaskRecord[]>(["tasks"], (previous = []) =>
        previous.filter((task) => task.id !== deletedTaskId)
      );
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.removeQueries({ queryKey: ["task-detail", deletedTaskId], exact: true });
    }
  });
}

export function useUpdateTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTaskInput) => window.desktop.updateTask(input),
    onSuccess: async (detail) => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.setQueryData(["task-detail", detail.task.id], detail);
    }
  });
}

export function useUpdateTaskStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTaskStatusInput) => window.desktop.updateTaskStatus(input),
    onSuccess: async (detail) => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.setQueryData(["task-detail", detail.task.id], detail);
    }
  });
}

export function useLinkTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LinkTaskInput) => window.desktop.linkTask(input),
    onSuccess: async (detail) => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.setQueryData(["task-detail", detail.task.id], detail);
    }
  });
}

export function useUnlinkTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UnlinkTaskInput) => window.desktop.unlinkTask(input),
    onSuccess: async (detail) => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.setQueryData(["task-detail", detail.task.id], detail);
    }
  });
}
