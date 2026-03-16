/*
Purpose: Compose the top-level renderer application with page-level navigation between tasks and resources.
Out of scope: Provider setup and low-level DOM mounting.
*/
import { useState } from "react";
import { BookOpen, CheckSquare } from "lucide-react";
import { HomePage } from "@/renderer/pages/home-page";
import { ResourcesPage } from "@/renderer/pages/resources-page";
import { cn } from "@/renderer/components/ui/class-names";

type Page = "tasks" | "resources";

export function App() {
  const [page, setPage] = useState<Page>("tasks");

  return (
    <div className="flex min-h-screen flex-col">
      {/* Навигационная панель */}
      <nav className="flex items-center gap-1 border-b border-slate-200 bg-white px-4 py-2">
        <button
          type="button"
          onClick={() => setPage("tasks")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
            page === "tasks"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
          )}
        >
          <CheckSquare className="size-4" />
          Задачи
        </button>
        <button
          type="button"
          onClick={() => setPage("resources")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
            page === "resources"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
          )}
        >
          <BookOpen className="size-4" />
          Ресурсы
        </button>
      </nav>

      {/* Контент страницы */}
      {page === "tasks" ? <HomePage /> : <ResourcesPage />}
    </div>
  );
}
