# World identity lives in the URL, not a stored "current world"

**Status:** accepted

The app is multi-world: a user owns several worlds and switches between them, and
every later surface (categories, subjects, facts, search) operates inside exactly
one world. That requires a notion of *which world am I in*. We put that identity
in the **URL path** — `/worlds/[worldId]/…` — rather than persisting a "current
world" server-side or in a cookie.

## Considered Options

- **URL path param (chosen):** the world id is a route segment. "Switching" is
  navigating to a different world's URL. Stateless, deep-linkable, back-button
  works, and RLS already scopes rows to the account so a foreign/bad id just
  404s. No schema change.
- **Stored active world (`accounts.active_world_id`):** one world visible at a
  time, no world in the URL; switching updates a column. Adds a column + write
  path, serializes the user to one world, breaks deep links, and introduces a
  stale-active-world bug class (e.g. after deleting the active world).
- **Cookie/session:** like the stored option but per-device and not persisted;
  same deep-link and staleness drawbacks.

## Consequences

- Routing for steps 6–12 is world-scoped under `/worlds/[worldId]`.
- A subject/fact URL carries its world, so links are shareable and bookmarkable.
- There is **no** "current world" stored anywhere — `/` is always the worlds
  list, and never auto-jumps to a last-opened world.
- An in-world **quick switcher** (top bar) and the `/` list are both just
  navigation between world URLs; neither mutates server state.
- Access control needs no world-ownership lookup in app code: an id the user
  doesn't own returns no rows under RLS → 404.
