/*
Назначение: Рендерит форму создания задачи или подзадачи с привязкой к проекту или родительской задаче.
Не входит: Отрисовка списка задач и взаимодействие с панелью деталей.
*/
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { createTaskInputSchema, type CreateTaskInput, type TaskRecord } from "@/shared/contracts/desktop-api";
import { Button } from "@/renderer/components/ui/button";
import { MilkdownEditor } from "@/renderer/editors/milkdown-editor";

type ParentTaskSummary = Pick<TaskRecord, "id" | "projectId" | "projectName" | "title">;

export interface TaskCreateFormProps {
  isSubmitting: boolean;
  onCreate(input: CreateTaskInput): void;
  parentTask?: ParentTaskSummary | null;
  projectSuggestions: string[];
  selectedProjectName: string | null;
}

export function TaskCreateForm({
  isSubmitting,
  onCreate,
  parentTask = null,
  projectSuggestions,
  selectedProjectName
}: TaskCreateFormProps) {
  const form = useForm<CreateTaskInput>({
    resolver: zodResolver(createTaskInputSchema),
    defaultValues: {
      parentTaskId: parentTask?.id,
      projectId: parentTask?.projectId,
      projectName: parentTask ? undefined : selectedProjectName ?? "",
      title: "",
      description: ""
    }
  });
  const [descriptionResetKey, setDescriptionResetKey] = useState(0);

  useEffect(() => {
    if (parentTask) {
      form.setValue("parentTaskId", parentTask.id, { shouldDirty: false, shouldValidate: false });
      form.setValue("projectId", parentTask.projectId, { shouldDirty: false, shouldValidate: false });
      form.setValue("projectName", undefined, { shouldDirty: false, shouldValidate: false });
      return;
    }

    form.setValue("parentTaskId", undefined, { shouldDirty: false, shouldValidate: false });
    form.setValue("projectId", undefined, { shouldDirty: false, shouldValidate: false });

    if (selectedProjectName) {
      form.setValue("projectName", selectedProjectName, { shouldDirty: false, shouldValidate: false });
      return;
    }

    form.setValue("projectName", undefined, { shouldDirty: false, shouldValidate: false });
  }, [form, parentTask, selectedProjectName]);

  return (
    <form
      className="space-y-3"
      onSubmit={form.handleSubmit((values) => {
        onCreate(parentTask
          ? {
              description: values.description,
              parentTaskId: parentTask.id,
              projectId: parentTask.projectId,
              title: values.title
            }
          : values);
        form.reset({
          parentTaskId: parentTask?.id,
          projectId: parentTask?.projectId,
          projectName: parentTask ? undefined : selectedProjectName ?? values.projectName ?? "",
          title: "",
          description: ""
        });
        setDescriptionResetKey((k) => k + 1);
      })}
    >
      {parentTask ? (
        <>
          <input type="hidden" {...form.register("parentTaskId")} />
          <input type="hidden" {...form.register("projectId")} />
        </>
      ) : null}

      {parentTask ? (
        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Родительская задача
          </p>
          <p className="mt-1 text-sm font-medium">{parentTask.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{parentTask.projectName}</p>
          {form.formState.errors.parentTaskId || form.formState.errors.projectId ? (
            <p className="app-error mt-2">
              {form.formState.errors.parentTaskId?.message ?? form.formState.errors.projectId?.message}
            </p>
          ) : null}
        </div>
      ) : (
        <div>
          <label className="app-label" htmlFor="task-project">
            Проект
          </label>
          <input
            id="task-project"
            className="app-input"
            list="task-project-suggestions"
            placeholder="Например, Мобильное приложение"
            {...form.register("projectName")}
          />
          <datalist id="task-project-suggestions">
            {projectSuggestions.map((projectName) => (
              <option key={projectName} value={projectName} />
            ))}
          </datalist>
          {form.formState.errors.projectName ? (
            <p className="app-error">{form.formState.errors.projectName.message}</p>
          ) : null}
        </div>
      )}

      <div>
        <label className="app-label" htmlFor="task-title">
          {parentTask ? "Новая подзадача" : "Новая задача"}
        </label>
        <input
          id="task-title"
          className="app-input"
          placeholder="Название задачи"
          {...form.register("title")}
        />
        {form.formState.errors.title ? (
          <p className="app-error">{form.formState.errors.title.message}</p>
        ) : null}
      </div>

      <div>
        <MilkdownEditor
          className="app-field"
          value={form.watch("description")}
          onChange={(value) => form.setValue("description", value, { shouldValidate: true })}
          resetKey={descriptionResetKey}
          placeholder="Описание, контекст, ограничения, ожидаемый результат..."
        />
        {form.formState.errors.description ? (
          <p className="app-error">{form.formState.errors.description.message}</p>
        ) : null}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Создание..." : parentTask ? "Создать подзадачу" : "Создать задачу"}
      </Button>
    </form>
  );
}
