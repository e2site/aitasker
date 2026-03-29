import { useAtom } from "jotai";
import { Copy } from "lucide-react";
import { useState } from "react";
import { selectedProjectIdAtom } from "@/renderer/features/projects/selected-project-id-state";
import { useProjectsQuery, useUpdateProjectProfileMutation } from "@/renderer/features/projects/use-project-queries";
import { usePromptOverridesQuery } from "@/renderer/features/prompts/use-prompt-override-queries";
import { getProjectPromptVars, resolvePrompt } from "@/renderer/components/mcp-prompt-presets";
import { ProjectCard } from "@/renderer/components/project-card";
import { Button } from "@/renderer/components/ui/button";

const MCP_ENDPOINT = "http://127.0.0.1:39291/mcp";

export function ProjectSettingsPage({ onClose }: { onClose(): void }) {
  const { data: projects = [] } = useProjectsQuery();
  const [selectedProjectId] = useAtom(selectedProjectIdAtom);
  const updateProjectProfileMutation = useUpdateProjectProfileMutation();
  const overridesQuery = usePromptOverridesQuery();
  const overrides = overridesQuery.data ?? [];
  const [copied, setCopied] = useState(false);

  const project = projects.find((p) => p.id === selectedProjectId) ?? null;

  if (!project) {
    return (
      <p className="text-sm text-muted-foreground">Выберите проект в боковой панели.</p>
    );
  }

  function copySkillPrompt() {
    const vars = getProjectPromptVars(project!);
    const prompt = resolvePrompt("project-skill", vars, overrides);
    if (!navigator.clipboard?.writeText) return;
    void navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Создать SKILL.md</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Скопируйте готовый prompt для AI-агента. Он создаст или обновит{" "}
              <code>SKILL.md</code> и опишет работу с MCP.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={copySkillPrompt}>
            <Copy className="size-4" />
            {copied ? "Скопировано!" : "Создать SKILLS"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Как подключить MCP</p>
          <p className="text-sm leading-6 text-muted-foreground">
            Сначала запустите AITasker. По умолчанию MCP endpoint:{" "}
            <code>{MCP_ENDPOINT}</code>
          </p>
        </div>
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Claude Code</p>
          <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs">
            <code>claude mcp add --transport http aitasker {MCP_ENDPOINT}</code>
          </pre>
        </div>
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Codex</p>
          <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs">
            <code>codex mcp add aitasker --url {MCP_ENDPOINT}</code>
          </pre>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          Если переопределён порт через <code>AITASKER_MCP_PORT</code>, замените URL на свой endpoint.
        </p>
      </div>

      <ProjectCard
        project={project}
        isUpdating={updateProjectProfileMutation.isPending}
        onSave={(input) => {
          updateProjectProfileMutation.mutate(input, { onSuccess: onClose });
        }}
      />
    </div>
  );
}
