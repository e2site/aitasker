// Purpose: Configure Drizzle Kit for generating SQLite migrations from the app schema.
// Out of scope: Database seeding and runtime connection management.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/main/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "./local/app.sqlite"
  }
});
