# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Auth (roadmap step 3):** Supabase email/password + Google OAuth, with email
  verification gate and password reset.
  - `accounts` table + migration: FK to `auth.users` (ON DELETE CASCADE),
    sign-up bootstrap trigger, and own-row RLS policy.
  - `proxy.ts` (Next 16 middleware) refreshes the session cookie and gates every
    route: unauthenticated → `/login?next=…`, unverified → `/verify-email`.
  - Route groups: `(app)/` protected home with sign-out; `(marketing)/` public
    auth pages — `/login`, `/signup` (visually distinct layouts), `/verify-email`,
    `/reset-password`, and the `/auth/callback` OAuth/email handler.
  - Server-only auth actions in `app/actions/auth.ts`.
- Technical design spec for the entry-based worldbuilding app (`docs/design.md`),
  including the facts-first gradient principle and the `@{id}` fact storage model.
- Ordered build roadmap (`docs/ROADMAP.md`).
- Project scaffold: Next.js 15 + TypeScript + Tailwind v4, ESLint config, base
  `app/` routes, and module-boundary stubs (`lib/db`, `lib/facts`,
  `lib/mentions`, `lib/supabase`).
- Drizzle ORM config and empty schema; Supabase browser/server client stubs.
- Baseline project files: README, `.env.example`, `.gitignore`.

[Unreleased]: https://example.com/compare
