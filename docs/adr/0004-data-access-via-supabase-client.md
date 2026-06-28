# Data access goes through the Supabase client; Drizzle is the schema blueprint

**Status:** accepted

All application reads and writes go through the **Supabase client** (the API path
that carries the user's auth token), **not** through Drizzle's direct Postgres
connection. Drizzle is retained as the **schema-as-TypeScript source of truth**
(`lib/db/schema.ts`) and the migration generator — but not as the query layer.
This supersedes design §3, which assigned querying to Drizzle (`lib/db/queries`).

## Background — the "two doors"

There are two ways the server can reach Postgres:

- **Door 1 — Supabase client (PostgREST):** the request carries the user's JWT,
  so `auth.uid()` resolves to the user. The step-4 security then works as
  designed: `account_id` is **auto-stamped** by `DEFAULT auth.uid()`, and **RLS**
  (`account_id = auth.uid()`) is enforced by the database on every row.
- **Door 2 — Drizzle over `DATABASE_URL` (direct postgres-js):** no JWT, so
  `auth.uid()` is **NULL**. The `DEFAULT auth.uid()` would insert NULL (failing
  `NOT NULL`), and RLS cannot protect the rows (the admin role bypasses it, or —
  with a restricted role — every policy fails because there is no identity to
  match). Ownership would have to be enforced in app code on **every** read and
  write, by hand.

## Considered Options

- **Door 1 for all reads + writes (chosen):** the database guarantees ownership
  and auto-stamps the owner. No hand-written `account_id`, no per-query owner
  filters, no "if a developer forgets one filter, data leaks" risk. Cost: the
  Supabase query surface is less ergonomic than Drizzle for very complex reads,
  and multi-row atomic writes need care (see below).
- **Door 2 (Drizzle) for everything, app-enforced ownership:** keeps the nice
  ORM and real transactions, but moves the entire security guarantee into app
  discipline — one missing `WHERE account_id = me` on a read or write exposes
  other users' data. Rejected: too easy to get wrong.
- **Split (Drizzle reads / door-1 writes):** considered and rejected — reads need
  the same ownership guard as writes, so putting reads on door 2 reintroduces the
  exact hand-filtering risk we were eliminating.

## Consequences

- **Ownership is database-enforced** for every operation; app code does not set
  `account_id` or filter by owner.
- **Drizzle stays** as `schema.ts` + migration generation; step-4 RLS and
  `auth.uid()` defaults are now load-bearing (not just a future-proofing net).
- **Atomic multi-row writes** (e.g. world + 5 default categories) can't span two
  PostgREST calls in one transaction. Step 5 uses **undo-on-failure** (create
  world, create categories, delete world if the second fails). A single Postgres
  function called via `rpc()` is the bulletproof upgrade if atomicity ever
  matters.
- **Complex reads** that are painful through PostgREST (e.g. the step-12 search
  dual-match) may selectively use Drizzle — but only with explicit owner
  filtering, decided per query at that point.
