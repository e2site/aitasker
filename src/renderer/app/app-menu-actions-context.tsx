/*
Назначение: Хранит общее состояние правых действий AppMenu и дает доступ к ним из разных частей renderer.
Не входит: Реализация самих UI-кнопок меню и бизнес-логика задач.
*/
import { createContext, useContext, useState, type PropsWithChildren } from "react";

export interface AppMenuTaskActions {
  isExportingData: boolean;
  isImportingData: boolean;
  onCopyAgentPrompt(): void;
  onOpenCreateModal(): void;
  onOpenPromptOverrides(): void;
  onExportData(): void;
  onImportData(): void;
}

const AppMenuTaskActionsStateContext = createContext<AppMenuTaskActions | null>(null);
const AppMenuTaskActionsSetterContext = createContext<((actions: AppMenuTaskActions | null) => void) | null>(null);

export function AppMenuActionsProvider({ children }: PropsWithChildren) {
  const [taskActions, setTaskActions] = useState<AppMenuTaskActions | null>(null);

  return (
    <AppMenuTaskActionsSetterContext.Provider value={setTaskActions}>
      <AppMenuTaskActionsStateContext.Provider value={taskActions}>
        {children}
      </AppMenuTaskActionsStateContext.Provider>
    </AppMenuTaskActionsSetterContext.Provider>
  );
}

export function useAppMenuTaskActions() {
  return useContext(AppMenuTaskActionsStateContext);
}

export function useSetAppMenuTaskActions() {
  const setTaskActions = useContext(AppMenuTaskActionsSetterContext);

  if (!setTaskActions) {
    throw new Error("useSetAppMenuTaskActions must be used within AppMenuActionsProvider.");
  }

  return setTaskActions;
}
