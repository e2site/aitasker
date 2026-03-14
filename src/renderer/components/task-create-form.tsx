/*
Назначение: Рендерит форму создания задачи с обязательной привязкой к проекту.
Не входит: Отрисовка списка задач и взаимодействие с панелью деталей.
*/
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { createTaskInputSchema, type CreateTaskInput } from "@/shared/contracts/desktop-api";
import { Button } from "@/renderer/components/ui/button";

export interface TaskCreateFormProps {
  isSubmitting: boolean;
  onCreate(input: CreateTaskInput): void;
  projectSuggestions: string[];
  selectedProjectName: string | null;
}

export function TaskCreateForm({
  isSubmitting,
  onCreate,
  projectSuggestions,
  selectedProjectName
}: TaskCreateFormProps) {
  const form = useForm<CreateTaskInput>({
    resolver: zodResolver(createTaskInputSchema),
    defaultValues: {
      projectName: selectedProjectName ?? "",
      title: "",
      description: ""
    }
  });

  useEffect(() => {
    if (selectedProjectName) {
      form.setValue("projectName", selectedProjectName, { shouldDirty: false, shouldValidate: false });
      return;
    }

    form.setValue("projectName", "", { shouldDirty: false, shouldValidate: false });
  }, [form, selectedProjectName]);

  return (
    <form
      className="space-y-3"
      onSubmit={form.handleSubmit((values) => {
        onCreate(values);
        form.reset({
          projectName: selectedProjectName ?? values.projectName ?? "",
          title: "",
          description: ""
        });
      })}
    >
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

      <div>
        <label className="app-label" htmlFor="task-title">
          Новая задача
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
        <textarea
          className="app-field"
          placeholder="Описание, контекст, ограничения, ожидаемый результат..."
          {...form.register("description")}
        />
        {form.formState.errors.description ? (
          <p className="app-error">{form.formState.errors.description.message}</p>
        ) : null}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Создание..." : "Создать задачу"}
      </Button>
    </form>
  );
}
