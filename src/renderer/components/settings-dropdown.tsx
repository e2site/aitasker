/*
Назначение: Выпадающее меню глобальных настроек приложения — экспорт и импорт SQLite-базы, настройки промтов.
Не входит: Настройки проекта, навигация и бизнес-логика задач.
*/
import { Download, Settings, SlidersHorizontal, Upload } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/renderer/components/ui/dropdown-menu";

export interface SettingsDropdownProps {
  isExporting: boolean;
  isImporting: boolean;
  onExportData(): void;
  onImportData(): void;
  onOpenPromptOverrides(): void;
}

export function SettingsDropdown({ isExporting, isImporting, onExportData, onImportData, onOpenPromptOverrides }: SettingsDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Настройки приложения"
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <Settings className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 bg-white p-1.5 shadow-lg">
        <DropdownMenuItem
          onClick={onOpenPromptOverrides}
          className="gap-2 rounded-lg px-3 py-2 text-sm"
        >
          <SlidersHorizontal className="size-4 text-slate-500" />
          Настройки промтов
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onExportData}
          disabled={isExporting}
          className="gap-2 rounded-lg px-3 py-2 text-sm"
        >
          <Download className="size-4 text-slate-500" />
          {isExporting ? "Сохранение..." : "Сохранить все данные"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onImportData}
          disabled={isImporting}
          className="gap-2 rounded-lg px-3 py-2 text-sm"
        >
          <Upload className="size-4 text-slate-500" />
          {isImporting ? "Загрузка..." : "Загрузить данные"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
