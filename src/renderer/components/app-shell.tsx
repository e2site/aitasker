/*
Purpose: Provide the shared page layout used by the initial renderer workspace.
Out of scope: Feature-specific widgets and data fetching logic.
*/
import type { PropsWithChildren } from "react";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="app-header">
        <span className="text-sm font-semibold tracking-tight text-slate-700">AITasker</span>
      </header>
      <main className="app-surface flex-1">
        <div className="app-grid">{children}</div>
      </main>
    </div>
  );
}
