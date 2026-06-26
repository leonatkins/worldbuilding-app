import type { Config } from "drizzle-kit";
import { config } from "dotenv";

// drizzle-kit runs outside Next, so it does not auto-load .env.local. Load it
// (then .env as a fallback) so DATABASE_URL is available to the commands below.
config({ path: ".env.local" });
config();

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
