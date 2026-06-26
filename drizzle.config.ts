import type { Config } from "drizzle-kit";

// Drizzle migration tooling config. The schema is defined as TypeScript in
// lib/db/schema.ts; `npm run db:generate` diffs it into SQL migrations under
// ./drizzle, and `npm run db:migrate` applies them to DATABASE_URL.
export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
} satisfies Config;
