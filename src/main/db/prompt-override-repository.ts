/*
Назначение: Хранит и читает переопределения промтов из таблицы prompt_overrides.
Не входит: Валидация входных данных и рендеринг шаблонов.
*/
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PromptOverrideRecord } from "../../shared/contracts/desktop-api";
import { promptOverridesTable } from "./schema";
import type { databaseSchema } from "./schema";

export class PromptOverrideRepository {
  constructor(private readonly db: BetterSQLite3Database<typeof databaseSchema>) {}

  upsert(id: string, template: string): PromptOverrideRecord {
    const now = Date.now();

    const existing = this.db
      .select()
      .from(promptOverridesTable)
      .where(eq(promptOverridesTable.id, id))
      .all();

    if (existing.length > 0) {
      this.db
        .update(promptOverridesTable)
        .set({ template, updatedAt: new Date(now) })
        .where(eq(promptOverridesTable.id, id))
        .run();
    } else {
      this.db
        .insert(promptOverridesTable)
        .values({ id, template, createdAt: new Date(now), updatedAt: new Date(now) })
        .run();
    }

    return this.toRecord(id, template, existing[0]?.createdAt ?? new Date(now), new Date(now));
  }

  getById(id: string): PromptOverrideRecord | null {
    const rows = this.db
      .select()
      .from(promptOverridesTable)
      .where(eq(promptOverridesTable.id, id))
      .all();

    if (rows.length === 0) return null;
    const row = rows[0];
    return this.toRecord(row.id, row.template, row.createdAt, row.updatedAt);
  }

  list(): PromptOverrideRecord[] {
    return this.db
      .select()
      .from(promptOverridesTable)
      .all()
      .map((row) => this.toRecord(row.id, row.template, row.createdAt, row.updatedAt));
  }

  delete(id: string): boolean {
    const result = this.db
      .delete(promptOverridesTable)
      .where(eq(promptOverridesTable.id, id))
      .run();

    return result.changes > 0;
  }

  private toRecord(
    id: string,
    template: string,
    createdAt: Date,
    updatedAt: Date
  ): PromptOverrideRecord {
    return {
      id,
      template,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString()
    };
  }
}
