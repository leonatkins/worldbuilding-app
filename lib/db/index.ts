/**
 * Server-side Drizzle client over a postgres-js connection.
 *
 * Import this only in server code (server components, server actions, route
 * handlers). It reads DATABASE_URL and must never be bundled to the client.
 *
 * Usage (once tables exist in ./schema):
 *   import { db } from "@/lib/db";
 *   const rows = await db.select().from(worlds);
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Surfaced loudly during setup rather than failing deep inside a query.
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
}

// Reuse a single connection across hot reloads in dev.
const globalForDb = globalThis as unknown as {
  client?: ReturnType<typeof postgres>;
};

const client = globalForDb.client ?? postgres(connectionString, { prepare: false });
if (process.env.NODE_ENV !== "production") globalForDb.client = client;

export const db = drizzle(client, { schema });
