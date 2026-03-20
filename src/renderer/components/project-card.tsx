/*
Назначение: Отображает карточку проекта с метаданными, редактированием и кнопкой копирования MCP-промта.
Не входит: Загрузка данных проекта, создание задач и навигация между проектами.
*/
import { useState } from "react";
import { Check, ClipboardCopy, FolderOpen, Pencil, X } from "lucide-react";
import type { ProjectRecord, UpdateProjectProfileInput } from "@/shared/contracts/desktop-api";
import { buildProjectActivationCopyPrompt } from "@/renderer/components/mcp-prompt-presets";
import { Button } from "@/renderer/components/ui/button";
import { Input } from "@/renderer/components/ui/input";
import { Label } from "@/renderer/components/ui/label";
import { Textarea } from "@/renderer/components/ui/textarea";

export interface ProjectCardProps {
  isUpdating: boolean;
  onSave(input: UpdateProjectProfileInput): void;
  project: ProjectRecord;
}

export function ProjectCard({ project, isUpdating, onSave }: ProjectCardProps) {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [rootPath, setRootPath] = useState(project.rootPath ?? "");
  const [languages, setLanguages] = useState(project.languages.join(", "));
  const [skillFilePath, setSkillFilePath] = useState(project.skillFilePath ?? "");

  function handleEdit() {
    setName(project.name);
    setDescription(project.description);
    setRootPath(project.rootPath ?? "");
    setLanguages(project.languages.join(", "));
    setSkillFilePath(project.skillFilePath ?? "");
    setEditing(true);
  }

  function handleCancel() {
    setEditing(false);
  }

  function handleSave() {
    const parsedLanguages = languages
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);

    onSave({
      projectId: project.id,
      name: name.trim() || undefined,
      description: description.trim() || undefined,
      rootPath: rootPath.trim() || null,
      languages: parsedLanguages,
      skillFilePath: skillFilePath.trim() || null
    });
    setEditing(false);
  }

  function handleCopyPrompt() {
    const prompt = buildProjectActivationCopyPrompt(project);

    void navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (editing) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="app-label">Редактирование</p>
          <Button type="button" variant="ghost" size="icon-sm" disabled={isUpdating} onClick={handleCancel}>
            <X />
          </Button>
        </div>

        {/* Fields */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pc-name">Название</Label>
            <Input
              id="pc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название проекта"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pc-description">Описание</Label>
            <Textarea
              id="pc-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание проекта"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pc-root-path">Путь к проекту</Label>
            <Input
              id="pc-root-path"
              value={rootPath}
              onChange={(e) => setRootPath(e.target.value)}
              placeholder="/path/to/project"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pc-languages">Языки <span className="text-slate-400">(через запятую)</span></Label>
            <Input
              id="pc-languages"
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              placeholder="TypeScript, CSS, HTML"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pc-skill-file">SKILL.md</Label>
            <Input
              id="pc-skill-file"
              value={skillFilePath}
              onChange={(e) => setSkillFilePath(e.target.value)}
              placeholder="/path/to/SKILL.md"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button type="button" variant="default" size="sm" disabled={isUpdating} onClick={handleSave}>
            {isUpdating ? "Сохраняем..." : "Сохранить"}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={isUpdating} onClick={handleCancel}>
            Отмена
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header row: name + actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <FolderOpen className="size-3.5 shrink-0 text-slate-400" />
            <p className="truncate text-sm font-semibold text-slate-900">{project.name}</p>
            {project.isProfileComplete ? (
              <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                <Check className="size-2.5" /> заполнен
              </span>
            ) : (
              <span className="ml-1 inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                не заполнен
              </span>
            )}
          </div>
          {project.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{project.description}</p>
          ) : (
            <p className="mt-1 text-xs text-slate-400 italic">Описание не заполнено</p>
          )}
        </div>

        {/* Icon buttons */}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title={copied ? "Скопировано!" : "Копировать MCP-промт"}
            onClick={handleCopyPrompt}
          >
            {copied ? <Check className="text-emerald-500" /> : <ClipboardCopy />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Редактировать проект"
            onClick={handleEdit}
          >
            <Pencil />
          </Button>
        </div>
      </div>

      {/* Meta fields */}
      <div className="space-y-1.5 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
        <MetaRow label="ID" value={project.id} mono />
        <MetaRow label="Путь" value={project.rootPath ?? "—"} mono />
        <MetaRow
          label="Языки"
          value={project.languages.length ? project.languages.join(", ") : "—"}
        />
        <MetaRow label="SKILL.md" value={project.skillFilePath ?? "—"} mono />
      </div>
    </div>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
        {label}
      </span>
      <span className={`min-w-0 truncate text-xs text-slate-600 ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}
