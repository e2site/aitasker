/*
Purpose: Create and expose the local SQLite database connection used by the main process.
Out of scope: Repository implementations, domain orchestration, and renderer-facing APIs.
*/
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { bootstrapDatabase } from "./bootstrap-database";
import { databaseSchema } from "./schema";

export type AppDatabase = BetterSQLite3Database<typeof databaseSchema>;

export interface DatabaseContext {
  database: AppDatabase;
  databasePath: string;
  sqlite: Database.Database;
}

export function createAppDatabase(userDataPath: string): DatabaseContext {
  mkdirSync(userDataPath, { recursive: true });

  const databasePath = join(userDataPath, "aitasker.sqlite");
  const sqlite = new Database(databasePath);

  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  bootstrapDatabase(sqlite);

  return {
    database: drizzle(sqlite, { schema: databaseSchema }),
    databasePath,
    sqlite
  };
}
