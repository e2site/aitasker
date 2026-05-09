/*
Назначение: Собирает renderer-представление дерева задач и подзадач, включая фильтрацию, раскрытие и поиск предков.
Не входит: Загрузка задач из API, отрисовка таблицы и изменение задач в базе.
*/
import type { TaskRecord, TaskStatus } from "@/shared/contracts/desktop-api";

export interface TaskFilterState {
  searchQuery: string;
  selectedStatuses: TaskStatus[];
}

export interface TaskTreeRow {
  childrenCount: number;
  depth: number;
  hasChildren: boolean;
  task: TaskRecord;
}

function normalizeSearchQuery(searchQuery: string): string {
  return searchQuery.trim().toLocaleLowerCase("ru-RU");
}

export function hasActiveTaskFilters(filter: TaskFilterState): boolean {
  return filter.selectedStatuses.length > 0 || normalizeSearchQuery(filter.searchQuery).length > 0;
}

export function taskMatchesFilter(task: TaskRecord, filter: TaskFilterState): boolean {
  const normalizedSearchQuery = normalizeSearchQuery(filter.searchQuery);
  const matchesStatus = filter.selectedStatuses.length === 0 || filter.selectedStatuses.includes(task.status);

  if (!matchesStatus) {
    return false;
  }

  if (!normalizedSearchQuery) {
    return true;
  }

  return [task.title, task.description, task.projectName, task.planContentMd ?? ""]
    .join(" ")
    .toLocaleLowerCase("ru-RU")
    .includes(normalizedSearchQuery);
}

export function collectAncestorTaskIds(tasks: TaskRecord[], taskId: string | null): string[] {
  if (!taskId) {
    return [];
  }

  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const ancestorIds: string[] = [];
  const visitedIds = new Set<string>();
  let current = tasksById.get(taskId) ?? null;

  while (current?.parentTaskId) {
    if (visitedIds.has(current.parentTaskId)) {
      break;
    }

    visitedIds.add(current.parentTaskId);
    ancestorIds.unshift(current.parentTaskId);
    current = tasksById.get(current.parentTaskId) ?? null;
  }

  return ancestorIds;
}

export function collectDescendantTaskIds(tasks: TaskRecord[], taskId: string): string[] {
  const childrenByParentId = new Map<string, TaskRecord[]>();

  for (const task of tasks) {
    if (!task.parentTaskId) {
      continue;
    }

    const children = childrenByParentId.get(task.parentTaskId) ?? [];
    children.push(task);
    childrenByParentId.set(task.parentTaskId, children);
  }

  const descendantIds: string[] = [];
  const visitedIds = new Set<string>();
  const stack = [...(childrenByParentId.get(taskId) ?? [])];

  while (stack.length > 0) {
    const task = stack.pop();

    if (!task || visitedIds.has(task.id)) {
      continue;
    }

    visitedIds.add(task.id);
    descendantIds.push(task.id);
    stack.push(...(childrenByParentId.get(task.id) ?? []));
  }

  return descendantIds;
}

export function filterTasksForTree(tasks: TaskRecord[], filter: TaskFilterState): {
  filteredCount: number;
  tasks: TaskRecord[];
} {
  if (!hasActiveTaskFilters(filter)) {
    return { filteredCount: tasks.length, tasks };
  }

  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const visibleIds = new Set<string>();
  let filteredCount = 0;

  for (const task of tasks) {
    if (!taskMatchesFilter(task, filter)) {
      continue;
    }

    filteredCount += 1;
    visibleIds.add(task.id);

    let parentTaskId = task.parentTaskId;
    while (parentTaskId) {
      if (visibleIds.has(parentTaskId)) {
        break;
      }

      visibleIds.add(parentTaskId);
      parentTaskId = tasksById.get(parentTaskId)?.parentTaskId ?? null;
    }
  }

  return {
    filteredCount,
    tasks: tasks.filter((task) => visibleIds.has(task.id))
  };
}

export function buildTaskTreeRows(
  tasks: TaskRecord[],
  expandedTaskIds: ReadonlySet<string>,
  options: { forceExpanded?: boolean } = {}
): TaskTreeRow[] {
  const taskIds = new Set(tasks.map((task) => task.id));
  const childrenByParentId = new Map<string | null, TaskRecord[]>();

  for (const task of tasks) {
    const parentTaskId = task.parentTaskId && taskIds.has(task.parentTaskId) ? task.parentTaskId : null;
    const children = childrenByParentId.get(parentTaskId) ?? [];
    children.push(task);
    childrenByParentId.set(parentTaskId, children);
  }

  const rows: TaskTreeRow[] = [];
  const visitedIds = new Set<string>();

  const pushTask = (task: TaskRecord, depth: number) => {
    if (visitedIds.has(task.id)) {
      return;
    }

    visitedIds.add(task.id);

    const children = childrenByParentId.get(task.id) ?? [];
    const hasChildren = children.length > 0;
    rows.push({
      childrenCount: children.length,
      depth,
      hasChildren,
      task
    });

    if (!hasChildren || (!options.forceExpanded && !expandedTaskIds.has(task.id))) {
      return;
    }

    for (const child of children) {
      pushTask(child, depth + 1);
    }
  };

  for (const task of childrenByParentId.get(null) ?? []) {
    pushTask(task, 0);
  }

  return rows;
}
