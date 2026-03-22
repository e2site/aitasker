/*
Назначение: Рендерит правый блок действий в AppMenu — настройки и создание задачи.
Не входит: Переключение проектов, выбор активного проекта и модальные окна карточки проекта.
*/
import { ChevronDown, Copy, Download, Plus, Settings, SlidersHorizontal, Upload } from "lucide-react";
import { APP_THEME } from "@/renderer/app/theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/renderer/components/ui/dropdown-menu";

export interface TaskTableTopBarProjectControlsProps {
  isExportingData: boolean;
  isImportingData: boolean;
  onCopyAgentPrompt(): void;
  onOpenCreateModal(): void;
  onOpenPromptOverrides(): void;
  onExportData(): void;
  onImportData(): void;
}

export function TaskTableTopBarProjectControls({
  isExportingData,
  isImportingData,
  onCopyAgentPrompt,
  onOpenCreateModal,
  onOpenPromptOverrides,
  onExportData,
  onImportData
}: TaskTableTopBarProjectControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Настройка приложения"
            className="flex items-center gap-1.5 px-2 py-2 font-medium text-slate-700 transition hover:text-slate-900"
            style={{ fontSize: 22 }}
          >
            <Settings className="size-5" />
            Настройка
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 bg-white p-1.5 shadow-lg">
          <DropdownMenuItem onClick={onOpenPromptOverrides} className="gap-2 rounded-lg px-3 py-2 text-sm">
            <SlidersHorizontal className="size-4 text-slate-500" />
            Настройки промтов
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onExportData}
            disabled={isExportingData}
            className="gap-2 rounded-lg px-3 py-2 text-sm"
          >
            <Download className="size-4 text-slate-500" />
            {isExportingData ? "Сохранение..." : "Сохранить все данные"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onImportData}
            disabled={isImportingData}
            className="gap-2 rounded-lg px-3 py-2 text-sm"
          >
            <Upload className="size-4 text-slate-500" />
            {isImportingData ? "Загрузка..." : "Загрузить данные"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-none px-6 py-[13px] font-medium transition"
            style={{
              backgroundColor: APP_THEME.menuItemActiveBackground,
              color: APP_THEME.menuItemActiveText,
              fontSize: 22
            }}
          >
            <Plus className="size-4" />
            Создать задачу
            <ChevronDown className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 bg-white p-1.5 shadow-lg">
          <DropdownMenuItem onClick={onOpenCreateModal} className="gap-2 rounded-lg px-3 py-2 text-sm">
            <Plus className="size-4 text-slate-500" />
            Создать задачу
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onCopyAgentPrompt} className="gap-2 rounded-lg px-3 py-2 text-sm">
            <Copy className="size-4 text-slate-500" />
            Создать задачу в агенте
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
