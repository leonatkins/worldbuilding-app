# Step 4 — Data Model Migration #1

**Status:** Approved (grilled 2026-06-26)
**Roadmap step:** 4
**Depends on:** step 3 (`accounts` table, auth, RLS pattern)
**Source design:** [`design.md`](design.md) §4–5 · [ADR 0001](adr/0001-facts-as-plain-text-with-id-markers.md)

This step is **pure schema + RLS** — it creates the core worldbuilding tables and
their security rules. No feature behavior, no seed data, no UI.

---

## 1. Scope

### In scope — 8 tables (the ownership spine + hard dependencies)

| Table | Purpose |
|---|---|
| `worlds` | account-owned top-level container |
| `categories` | per world; name, icon, position |
| `schema_fields` | typed field definitions owned by a category |
| `subjects` | one category; archivable |
| `facts` | ordered plain text + `@{id}` markers, owned by a subject |
| `field_values` | a subject's value per field (scalar **or** single link) |
| `list_value_subjects` | join: List-field value ↔ member subjects |
| `relationships` | subject → subject backlink source (fact or field origin) |

### Deferred (built by their feature step)

- `tags`, `subject_tags` → **step 7** (Subject CRUD)
- `templates` → **step 13** (Templates)

`list_value_subjects` is in scope despite being a join table because
`field_values` List storage structurally requires it.

### Explicitly NOT in this step

- No free-tier "max 2 worlds" enforcement — gating is a late roadmap step
  (design §6). `accounts.tier` already exists; model only.
- No default-category seeding, no category triggers — step 5 seeds defaults from
  **app code** (design §4.4).
- No UI, no server actions, no queries.

---

## 2. Cross-cutting conventions (apply to every table)

### 2.1 Ownership column + RLS

Every table carries a denormalized owner column:

```
account_id uuid NOT NULL DEFAULT auth.uid() REFERENCES accounts(id) ON DELETE CASCADE
```

- **`DEFAULT auth.uid()`** — Postgres auto-stamps the owner from the logged-in
  session on insert; app code never sets it.
- **RLS** — every table gets, identical:

  ```sql
  ALTER TABLE "<t>" ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "<t>: own rows" ON "<t>" FOR ALL
    USING (account_id = auth.uid())
    WITH CHECK (account_id = auth.uid());
  ```

Denormalizing `account_id` onto every table (including join tables) keeps each
policy a one-liner with no join up the ownership tree — deliberate redundancy per
design §5. `WITH CHECK` makes the default un-spoofable.

### 2.2 Keys, timestamps, ordering

- **PK:** `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` (except join tables, see §3).
- **`created_at timestamptz NOT NULL DEFAULT now()`** on all 8 tables.
- **`updated_at timestamptz NOT NULL DEFAULT now()`** on editable tables
  (`worlds`, `categories`, `schema_fields`, `subjects`, `facts`, `field_values`).
  **App-managed** — server actions set it on update; no trigger. Omitted from
  `list_value_subjects` and `relationships` (insert/delete only).
- **`position` (ordering):** `double precision NOT NULL` on `categories`,
  `schema_fields`, `facts`. Midpoint insertion; rebalance if precision exhausts
  (design §4.1).

### 2.3 Delete behavior

CASCADE down the ownership spine; three special rules retained from design §4:

```
account ─CASCADE→ world ─CASCADE→ category ─CASCADE→ schema_fields
                  world ─CASCADE→ subject  ─CASCADE→ facts
                                  subject  ─CASCADE→ field_values ─CASCADE→ list_value_subjects
                  world ─CASCADE→ relationships
relationships.from_subject_id / to_subject_id          → CASCADE
schema_fields.target_category_id                       → RESTRICT (block category delete while referenced)
field_values.linked_subject_id                         → SET NULL (no orphan)
list_value_subjects.subject_id                         → CASCADE (drop from list)
```

RESTRICT vs CASCADE coexist correctly: deleting a category cascades its *own*
fields, but is **blocked** if another category's List/Link field still points at
it — the intended forced-cleanup behavior (design §4.2).

### 2.4 Enums

Two Postgres enums (Drizzle `pgEnum`), the only legal values for their columns:

- `field_type`: `List, Link, Text, Number, Boolean, Select, MultiSelect, Date, Scale, Color`
- `relationship_origin`: `fact, field`

---

## 3. Table-by-table columns

> `account_id`, `created_at`, `updated_at`, `id` per §2 — not repeated below.

### worlds
| Column | Type | Notes |
|---|---|---|
| `name` | text NOT NULL | display label |

### categories
| Column | Type | Notes |
|---|---|---|
| `world_id` | uuid NOT NULL FK→worlds CASCADE | |
| `name` | text NOT NULL | |
| `icon` | text NULL | emoji or icon name |
| `position` | double precision NOT NULL | |

### schema_fields
| Column | Type | Notes |
|---|---|---|
| `category_id` | uuid NOT NULL FK→categories CASCADE | owner |
| `name` | text NOT NULL | |
| `type` | `field_type` NOT NULL | enum |
| `position` | double precision NOT NULL | |
| `target_category_id` | uuid NULL FK→categories **RESTRICT** | List, Link |
| `select_options` | text[] NULL | Select, MultiSelect |
| `scale_min` | integer NULL | Scale |
| `scale_max` | integer NULL | Scale |
| `unit` | text NULL | Number |

Type-specific config in typed nullable columns (not JSONB) so Postgres enforces
the List/Link → category FK (design §4.2).

### subjects
| Column | Type | Notes |
|---|---|---|
| `category_id` | uuid NOT NULL FK→categories CASCADE | exactly one category |
| `world_id` | uuid NOT NULL FK→worlds CASCADE | denormalized for world-scoped queries/RLS simplicity |
| `name` | text NOT NULL | |
| `archived_at` | timestamptz NULL | NULL = active |

### facts
| Column | Type | Notes |
|---|---|---|
| `subject_id` | uuid NOT NULL FK→subjects CASCADE | owner |
| `body` | text NOT NULL | plain text + `@{id}` markers; label prefix is just leading text (ADR 0001) |
| `position` | double precision NOT NULL | |

### field_values
| Column | Type | Notes |
|---|---|---|
| `subject_id` | uuid NOT NULL FK→subjects CASCADE | |
| `field_id` | uuid NOT NULL FK→schema_fields CASCADE | |
| `scalar_value` | jsonb NULL | Text/Number/Boolean/Select/MultiSelect/Date/Scale/Color |
| `linked_subject_id` | uuid NULL FK→subjects **SET NULL** | Link (single subject) |
| | | **UNIQUE (subject_id, field_id)** |

List values are stored in `list_value_subjects`, not here.

### list_value_subjects (join)
| Column | Type | Notes |
|---|---|---|
| `field_value_id` | uuid NOT NULL FK→field_values CASCADE | |
| `subject_id` | uuid NOT NULL FK→subjects **CASCADE** | member |
| `account_id` | uuid NOT NULL DEFAULT auth.uid() FK→accounts CASCADE | RLS |
| | | **UNIQUE (field_value_id, subject_id)**; no `id` PK needed (composite) |

### relationships
| Column | Type | Notes |
|---|---|---|
| `from_subject_id` | uuid NOT NULL FK→subjects CASCADE | the subject doing the referencing |
| `to_subject_id` | uuid NOT NULL FK→subjects CASCADE | the referenced subject |
| `origin` | `relationship_origin` NOT NULL | fact \| field |
| `fact_id` | uuid NULL FK→facts CASCADE | set when origin = fact |
| `field_id` | uuid NULL FK→schema_fields CASCADE | set when origin = field |
| | | **UNIQUE (from_subject_id, to_subject_id, origin, fact_id, field_id)** — distinct backlinks |

---

## 4. Constraints summary

- `field_values` UNIQUE `(subject_id, field_id)` — one value per field per subject.
- `list_value_subjects` UNIQUE `(field_value_id, subject_id)` — no duplicate list members.
- `relationships` UNIQUE `(from_subject_id, to_subject_id, origin, fact_id, field_id)` — distinct backlinks; same subject mentioned twice in one fact → one row, different facts → separate rows.
- **No** name-uniqueness constraints on `categories`/`schema_fields` — names are
  display labels; app may warn but DB allows duplicates.

---

## 5. Build approach

Same pattern as `0000_accounts.sql`: Drizzle generates the tables, RLS/security is
hand-appended (Drizzle does not manage RLS, policies, or `auth.uid()` defaults).

1. Define all 8 tables + 2 `pgEnum`s in `lib/db/schema.ts` (replacing the planning
   comment block). Drizzle handles: tables, enums, inter-table FKs, cascades,
   unique constraints, `gen_random_uuid()`/`now()` defaults, and `auth.uid()`
   defaults via `.default(sql\`auth.uid()\`)`.
2. `npm run db:generate` → `drizzle/0001_*.sql`.
3. **Hand-append** to that file (split by `--> statement-breakpoint`): the 8
   `ENABLE ROW LEVEL SECURITY` + 8 `CREATE POLICY` blocks (§2.1). Verify the
   `auth.uid()` defaults generated cleanly; add by hand if not.
4. Rename the migration tag to `0001_data_model` (as `0000` was renamed).
5. `npm run db:migrate` against the cloud DB.
6. Commit schema + migration together (`feat:`). Update README (data model),
   CHANGELOG, ROADMAP (step 4 → ✅) in the same commit.

### Definition of done

- [ ] 8 tables created with columns, FKs, cascades, uniques per §3–4.
- [ ] `field_type` + `relationship_origin` enums exist.
- [ ] RLS enabled + own-rows policy on all 8 tables.
- [ ] `account_id DEFAULT auth.uid()` on all 8 tables.
- [ ] `npm run build` passes, `npm run lint` clean.
- [ ] Migration applied to cloud DB without error.
- [ ] Docs updated (README, CHANGELOG, ROADMAP).
