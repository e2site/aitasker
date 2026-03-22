/*
Назначение: Отрисовывает содержимое вкладки session в карточке задачи.
Не входит: Управление вкладками, выбор активной вкладки и загрузка состояния сессии.
*/
import type { TaskDetail } from "@/shared/contracts/desktop-api";

export interface TaskSessionTabProps {
  detail: TaskDetail;
}

export function TaskSessionTab({ detail }: TaskSessionTabProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="app-label">Agent session</p>
        <div className="mt-3 space-y-2 text-sm text-slate-600">
          <p>Provider: {detail.agentSession?.provider ?? "mcp"}</p>
          <p>Status: {detail.agentSession?.status ?? "idle"}</p>
          <p>MCP-ready: current task and plan are exposed through tools, resources, and prompt workflow</p>
        </div>
      </div>
    </div>
  );
}
