# Worldbuilding App

The language of a fact-first worldbuilding tool: a world is a collection of
subjects; a subject is a collection of facts. This glossary fixes the canonical
term for each domain concept so the PRD, design spec, and code stay aligned.

## Language

**World**:
The top-level organizational container — a named collection of subjects. The term is thematic, not literal; a multi-planet universe is one world with subjects representing each planet. Users may own multiple worlds (free tier: 2; paid: unlimited).
_Avoid_: Universe, project, campaign, setting

**Subject**:
The unit of identity in a world — a character, place, faction, spell, or concept.
Everything else (facts, tags, schema values) hangs off a subject.
_Avoid_: Entry, page, article, entity, record

**Fact**:
The atomic unit of information about a subject — a short note of one or two
sentences, with an optional label prefix. The primary thing a user creates;
never a prose paragraph.
_Avoid_: Note, statement, entry, paragraph

**Tag**:
A user-defined label applied to subjects for cross-cutting concerns (e.g. `#deceased`, `#arc-1`). Scoped to a world; rename and delete are single world-level operations affecting every subject carrying the tag at once — unlike every other entity, tag deletion is immediate and permanent (no Recently Deleted/Restore).
_Avoid_: Label, category (different concept)

**Mention**:
A reference from inside a fact to another subject, identified by that subject's
stable id and never by its name; it renders live as the subject's current name
and drives backlinks. (List and Link schema fields create the same kind of
reference by other means.)
_Avoid_: Reference, tag, backlink (backlink is the *inbound* view of a mention)

**Backlink**:
The inbound view of a Mention (or a List/Link field value): "Referenced by" on a
subject's page, grouped by source subject — not by field. A List/Link field's
optional `inverse_label` supplies the role name shown for its own backlinks
(e.g. "Mentor"); unset, the field's forward name is reused. Selecting several
backlinks and promoting them into a List field is one of the three ways facts
crystallize into schema (design §4.3).
_Avoid_: Reverse mention, inverse reference

**Field command**:
Typing `!` as the first character of a fresh fact fills a schema field directly
instead of writing a fact — a typeahead matches the category's fields by name,
and the value that follows is parsed for that field's type; an unmatched name
offers to create one. The line is consumed, never saved as a fact. The other of
the two deliberate bridges by which facts crystallize into schema (design §4.3),
alongside Backlink promotion.
_Avoid_: Bang command, `!` command, field autocomplete

**Search**:
A world-scoped search over subject names, fact text, and schema field values
(matched on both the field's name and its value) — combinable with category
(any-of) and tag (all-of) filters. It extends the fact dual-match (ADR 0001) to
fields: a Link/List field matches through its linked subject's current name, the
same way a fact matches through a Mention's resolved name, so a query is found
even when its text is never stored in the matched row's bytes. The tag filter
list, with per-tag subject counts, doubles as the tag browser — there is no
separate browsing surface.
_Avoid_: Semantic search, AI search (the PRD §7 World Q&A is a distinct, future
AI feature — this is plain substring + dual-match)

**Snapshot**:
The frozen, detached, UUID-free copy of category/field **structure** a template
stores (design §4.5); unpacked on apply. Structure only — no subjects, facts,
values, or UUIDs. List/Link targets are stored portably by `localKey` (world
templates) or the target category's *name* (schema templates), never by UUID.
_Avoid_: Template blob, template contents (too vague), serialized world (a
snapshot is structure, not a whole world's data)

**Apply (a template)**:
Unpack a snapshot into real `categories` + `schema_fields` rows in a
destination world; a copy, never a live link (cookie-cutter, not the cookie).
World-template apply runs through the `createWorld` path (replacing the default
seed) with an undo-on-failure chain; schema-template apply is either a merge
into an existing category or a new category from the template.
_Avoid_: Import, instantiate, deploy

**Stub category**:
An empty category auto-created on schema-template apply to satisfy a Link/List
field whose named target is absent in the destination world (A3). Created
before the referencing field (the `target_category_id` RESTRICT constraint),
so the field is immediately functional. Reported inline, no modal.
_Avoid_: Placeholder category, dummy category

**Template**:
A named, reusable structure — `schema` (one category's fields) or `world`
(full category structure) — stored as a snapshot. Built-in templates are
hardcoded TS constants (git-versioned, no DB table, no `is_official` flag);
private templates live in the `templates` table (user-owned, RLS own-rows).
Free to hold on both tiers; names not unique per owner.
_Avoid_: Preset, starter, blueprint, schema pack

**Onboarding guide**:
An informational panel (not a tutorial) accessible from a persistent `?` icon
in the app header, auto-opened once on first login, dismissable, and
re-accessible. First-login detection is a server column on `accounts`
(`onboarding_seen_at`, NULL = not yet seen); stamped on dismiss. Conceptual
copy only at this step (what things ARE); locational copy deferred to the
near-launch visual-polish pass.
_Avoid_: Tutorial, walkthrough, onboarding wizard
