import { useAtom } from "jotai";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { createProjectInputSchema } from "@/shared/contracts/desktop-api";
import { useCreateProjectMutation } from "@/renderer/features/projects/use-project-queries";
import { selectedProjectIdAtom } from "@/renderer/features/projects/selected-project-id-state";
import { Button } from "@/renderer/components/ui/button";
import { Input } from "@/renderer/components/ui/input";

export function CreateProjectPage({ onClose }: { onClose(): void }) {
  const createProjectMutation = useCreateProjectMutation();
  const [, setSelectedProjectId] = useAtom(selectedProjectIdAtom);

  const form = useForm<{ name: string }>({
    resolver: zodResolver(createProjectInputSchema),
    defaultValues: { name: "" },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit((values) => {
        createProjectMutation.mutate({ name: values.name }, {
          onSuccess(project) {
            setSelectedProjectId(project.id);
            onClose();
          },
        });
      })}
    >
      <div>
        <label className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground" htmlFor="project-name">
          Название проекта
        </label>
        <Input
          id="project-name"
          className="mt-2"
          placeholder="Например, Мобильное приложение"
          autoFocus
          {...form.register("name")}
        />
        {form.formState.errors.name ? (
          <p className="mt-2 text-sm text-destructive">{form.formState.errors.name.message}</p>
        ) : null}
      </div>
      <Button type="submit" disabled={createProjectMutation.isPending}>
        {createProjectMutation.isPending ? "Создание..." : "Создать проект"}
      </Button>
    </form>
  );
}
