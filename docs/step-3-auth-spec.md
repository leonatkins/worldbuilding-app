# Step 3: Auth — Implementation Spec

**Status:** Ready to implement
**Decided:** 2026-06-26

---

## What this step delivers

- Supabase email/password + Google OAuth
- Email verification gate
- Protected routes via Next.js middleware
- Password reset flow
- `accounts` table + trigger (account bootstrap)

---

## Database

### `accounts` table (created in this step — not step 4)

```sql
CREATE TABLE accounts (
  id   uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'free'
);
```

### Bootstrap trigger

A Postgres trigger on `auth.users` insert that auto-creates the `accounts` row:

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO accounts (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

This must be applied as a Drizzle migration (raw SQL). The trigger fires atomically with sign-up — no window where a user exists in Auth without an `accounts` row.

### RLS

Enable RLS on `accounts` and add a policy:

```sql
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounts: own row only"
  ON accounts FOR ALL
  USING (id = auth.uid());
```

---

## Routes

| Route | Access | Notes |
|---|---|---|
| `/` | Protected | Authenticated home — worlds list + future panels |
| `/login` | Public | Sign-in page |
| `/signup` | Public | Sign-up page |
| `/reset-password` | Public | Password reset flow |
| `/auth/callback` | Public | Supabase OAuth callback handler |
| `/verify-email` | Public | Shown to unverified users who try to access the app |

All routes under `(app)/` are protected. All routes under `(marketing)/` are public.

---

## Middleware

Next.js middleware (`middleware.ts` at root) handles:

1. Check session on every request to a protected route.
2. If no session → redirect to `/login?next=<original-url>`.
3. If session exists but email unverified → redirect to `/verify-email`.
4. If session valid → pass through.
5. Refresh the Supabase session cookie on every request (required by `@supabase/ssr`).

Matcher: all routes except `/_next`, `/api`, static assets, and the public auth routes.

---

## Auth pages

### `/login` (sign-in)
- Email + password fields
- "Sign in with Google" button
- Link to `/signup`
- Link to `/reset-password`
- On success → redirect to `?next` param or `/`

### `/signup` (sign-up)
- Email + password fields
- "Sign up with Google" button
- Link to `/login`
- On success → redirect to `/verify-email` (email/password) or `/` (Google, already verified)
- **Visually distinct layout from `/login`** — intentional contrast, not a copy-paste

### `/verify-email`
- Static "Check your inbox" message
- Resend verification email button
- No app access until verified

### `/reset-password`
- Step 1: enter email → Supabase sends reset link
- Step 2: Supabase redirects back with token → show new password form
- On success → redirect to `/login`

---

## Google OAuth

Configure in Supabase dashboard (Authentication → Providers → Google). Set redirect URL to `<your-url>/auth/callback`. The `/auth/callback` route handler exchanges the code for a session.

---

## Dev environment

Use the **hosted Supabase cloud project** for local dev (not local Docker). Fill in `.env.local` with the cloud project's URL and anon key. Data persists between dev sessions.

---

## File structure (expected output of this step)

```
app/
  (marketing)/
    login/
      page.tsx
    signup/
      page.tsx
    verify-email/
      page.tsx
    reset-password/
      page.tsx
    auth/
      callback/
        route.ts        ← OAuth code exchange
  (app)/
    layout.tsx          ← auth guard (or handled by middleware)
    page.tsx            ← authenticated home
middleware.ts           ← session check + cookie refresh
drizzle/
  <timestamp>_accounts.sql   ← accounts table + trigger + RLS
lib/
  db/
    schema.ts           ← add accounts table definition
```

---

## Out of scope for this step

- Worlds list UI (just render a placeholder on `/`)
- Billing / tier enforcement
- All other tables (step 4)
