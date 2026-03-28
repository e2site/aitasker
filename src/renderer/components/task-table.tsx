/*
Назначение: Рендерит топ-бар (поиск, фильтры статусов) и таблицу задач.
Не входит: Загрузка данных, панель деталей задачи, управление проектами.
*/
import * as React from "react";
import { useAtom } from "jotai";
import { ChevronDown, ChevronUp, ChevronsUpDown, Search, X } from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import type { TaskRecord, TaskStatus } from "@/shared/contracts/desktop-api";
import { TaskStatusBadge } from "@/renderer/components/task-status-badge";
import { Button } from "@/renderer/components/ui/button";
import { Input } from "@/renderer/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/renderer/components/ui/table";
import { TASK_STATUS_LIST, getTaskStatusMeta } from "@/renderer/features/tasks/task-status-meta";
import {
  taskSortAtom,
  STATUS_ORDER,
  type SortField,
  type TaskSortState,
} from "@/renderer/features/tasks/task-sort-state";
import { cn } from "@/renderer/components/ui/class-names";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

function sortTasks(tasks: TaskRecord[], sort: TaskSortState): TaskRecord[] {
  return [...tasks].sort((a, b) => {
    let cmp = 0;
    if (sort.field === "status") {
      cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    } else if (sort.field === "createdAt" || sort.field === "updatedAt") {
      cmp = new Date(a[sort.field]).getTime() - new Date(b[sort.field]).getTime();
    } else {
      cmp = (a[sort.field] ?? "").localeCompare(b[sort.field] ?? "", "ru");
    }
    return sort.direction === "asc" ? cmp : -cmp;
  });
}

const SORT_FIELDS: SortField[] = ["status", "title", "projectName", "createdAt", "updatedAt"];
const HEADERS: Record<SortField, string> = {
  status: "Статус",
  title: "Задача",
  projectName: "Проект",
  createdAt: "Создано",
  updatedAt: "Обновлено",
};

export interface TaskTableProps {
  tasks: TaskRecord[];
  filteredCount: number;
  totalCount: number;
  selectedTaskId: string | null;
  showProject: boolean;
  onSelect(taskId: string): void;
  searchQuery: string;
  selectedStatuses: TaskStatus[];
  onSearchChange(query: string): void;
  onStatusFilterChange(statuses: TaskStatus[]): void;
}

export function TaskTable({
  tasks,
  filteredCount,
  totalCount,
  selectedTaskId,
  showProject,
  onSelect,
  searchQuery,
  selectedStatuses,
  onSearchChange,
  onStatusFilterChange,
}: TaskTableProps) {
  const [sort, setSort] = useAtom(taskSortAtom);

  const handleSort = (field: SortField) => {
    setSort((prev) =>
      prev.field === field
        ? { field, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { field, direction: "desc" }
    );
  };

  const toggleStatus = (status: TaskStatus) => {
    const next = selectedStatuses.includes(status)
      ? selectedStatuses.filter((s) => s !== status)
      : [...selectedStatuses, status];
    onStatusFilterChange(next);
  };

  const sortedTasks = React.useMemo(() => sortTasks(tasks, sort), [tasks, sort]);

  const columns = React.useMemo<ColumnDef<TaskRecord>[]>(() => {
    const cols: ColumnDef<TaskRecord>[] = [
      {
        id: "status",
        cell: ({ row }) => <TaskStatusBadge status={row.original.status} />,
      },
      {
        id: "title",
        cell: ({ row }) => (
          <div className="max-w-xs lg:max-w-sm">
            <p className="truncate font-medium">{row.original.title}</p>
            {row.original.description ? (
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{row.original.description}</p>
            ) : null}
          </div>
        ),
      },
    ];

    if (showProject) {
      cols.push({
        id: "projectName",
        cell: ({ row }) => (
          <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
            {row.original.projectName}
          </span>
        ),
      });
    }

    cols.push(
      {
        id: "createdAt",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "updatedAt",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDate(row.original.updatedAt)}
          </span>
        ),
      },
      {
        id: "shortId",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.id.slice(0, 8).toUpperCase()}
          </span>
        ),
      }
    );

    return cols;
  }, [showProject]);

  const table = useReactTable({
    data: sortedTasks,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  const visibleFields = React.useMemo<SortField[]>(
    () => SORT_FIELDS.filter((f) => f !== "projectName" || showProject),
    [showProject]
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Search + status filters + counter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Поиск задач..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {TASK_STATUS_LIST.map(({ value, filterLabel }) => {
            const active = selectedStatuses.includes(value);
            const meta = getTaskStatusMeta(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleStatus(value)}
                className={cn(
                  "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? cn(meta.badgeClass, "border-transparent")
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                {filterLabel}
              </button>
            );
          })}
        </div>

        {selectedStatuses.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onStatusFilterChange([])}>
            <X className="size-3.5" />
            Сбросить
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {filteredCount === totalCount
            ? `${totalCount} задач`
            : `${filteredCount} из ${totalCount}`}
        </span>
      </div>

      {/* Table */}
      {tasks.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed py-16 text-sm text-muted-foreground">
          Нет задач, соответствующих фильтрам.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {visibleFields.map((field) => (
                  <TableHead
                    key={field}
                    onClick={() => handleSort(field)}
                    className="cursor-pointer select-none hover:text-foreground"
                  >
                    <span className="flex items-center gap-1">
                      {HEADERS[field]}
                      {sort.field === field ? (
                        sort.direction === "asc"
                          ? <ChevronUp className="size-3" />
                          : <ChevronDown className="size-3" />
                      ) : (
                        <ChevronsUpDown className="size-3 opacity-40" />
                      )}
                    </span>
                  </TableHead>
                ))}
                <TableHead>ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => {
                const isActive = row.original.id === selectedTaskId;
                return (
                  <TableRow
                    key={row.id}
                    onClick={() => onSelect(row.original.id)}
                    data-state={isActive ? "selected" : undefined}
                    className="cursor-pointer"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
