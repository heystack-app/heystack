import { defineConfig } from "drizzle-kit";

// For future schema migrations. db/init.sql seeds the schema on first boot in
// v0.1; once the schema starts changing, generate migrations into db/migrations.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://heystack:heystack@localhost:5432/heystack",
  },
});
