/*
Назначение: Хранит и читает task context задачи (goal, criticalConditions, forbiddenInterpretations, acceptanceCriteria) в отдельных таблицах БД.
Не входит: Бизнес-валидация входных данных и orchestration сохранения плана.
*/
import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import type { TaskContextRecord } from "../../shared/contracts/desktop-api";
import type { AppDatabase } from "./database";
import {
  taskAcceptanceCriteriaTable,
  taskCriticalConditionsTable,
  taskForbiddenInterpretationsTable,
  taskGoalsTable
} from "./schema";

function createEmptyTaskContext(): TaskContextRecord {
  return {
    goal: [],
    criticalConditions: [],
    forbiddenInterpretations: [],
    acceptanceCriteria: []
  };
}

export class TaskContextRepository {
  constructor(private readonly database: AppDatabase) {}

  async getByTaskId(taskId: string): Promise<TaskContextRecord> {
    const [goalRows, criticalRows, forbiddenRows, acceptanceRows] = await Promise.all([
      this.database
        .select()
        .from(taskGoalsTable)
        .where(eq(taskGoalsTable.taskId, taskId))
        .orderBy(asc(taskGoalsTable.createdAt))
        .all(),
      this.database
        .select()
        .from(taskCriticalConditionsTable)
        .where(eq(taskCriticalConditionsTable.taskId, taskId))
        .orderBy(asc(taskCriticalConditionsTable.createdAt))
        .all(),
      this.database
        .select()
        .from(taskForbiddenInterpretationsTable)
        .where(eq(taskForbiddenInterpretationsTable.taskId, taskId))
        .orderBy(asc(taskForbiddenInterpretationsTable.createdAt))
        .all(),
      this.database
        .select()
        .from(taskAcceptanceCriteriaTable)
        .where(eq(taskAcceptanceCriteriaTable.taskId, taskId))
        .orderBy(asc(taskAcceptanceCriteriaTable.createdAt))
        .all()
    ]);

    const result = createEmptyTaskContext();
    result.goal = goalRows.map((row) => row.value);
    result.criticalConditions = criticalRows.map((row) => row.value);
    result.forbiddenInterpretations = forbiddenRows.map((row) => row.value);
    result.acceptanceCriteria = acceptanceRows.map((row) => row.value);

    return result;
  }

  async replaceByTaskId(taskId: string, input: TaskContextRecord): Promise<void> {
    const now = new Date();

    this.database.transaction((tx) => {
      tx.delete(taskGoalsTable).where(eq(taskGoalsTable.taskId, taskId)).run();
      tx
        .delete(taskCriticalConditionsTable)
        .where(eq(taskCriticalConditionsTable.taskId, taskId))
        .run();
      tx
        .delete(taskForbiddenInterpretationsTable)
        .where(eq(taskForbiddenInterpretationsTable.taskId, taskId))
        .run();
      tx
        .delete(taskAcceptanceCriteriaTable)
        .where(eq(taskAcceptanceCriteriaTable.taskId, taskId))
        .run();

      for (const value of input.goal) {
        tx
          .insert(taskGoalsTable)
          .values({ id: randomUUID(), taskId, value, createdAt: now, updatedAt: now })
          .run();
      }

      for (const value of input.criticalConditions) {
        tx
          .insert(taskCriticalConditionsTable)
          .values({ id: randomUUID(), taskId, value, createdAt: now, updatedAt: now })
          .run();
      }

      for (const value of input.forbiddenInterpretations) {
        tx
          .insert(taskForbiddenInterpretationsTable)
          .values({ id: randomUUID(), taskId, value, createdAt: now, updatedAt: now })
          .run();
      }

      for (const value of input.acceptanceCriteria) {
        tx
          .insert(taskAcceptanceCriteriaTable)
          .values({ id: randomUUID(), taskId, value, createdAt: now, updatedAt: now })
          .run();
      }
    });
  }
}
