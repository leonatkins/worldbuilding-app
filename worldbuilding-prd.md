# PRD: Entry-Based Worldbuilding App
**Status:** Draft v0.2  
**Author:** Leon  
**Last updated:** June 2026

---

## 1. Problem

Existing worldbuilding tools force a false choice: either a bloated wiki-editor (World Anvil, Kanka) that demands prose and has a steep learning curve, or a general-purpose tool (Google Docs, Notion) that provides no structure at all. Neither fits the user who thinks in *facts*, not essays — someone who wants to record "Aragorn: raised by elves, unaware of his lineage until age 20, dislikes boats" as a list of atomic statements, not a Wikipedia article.

The result: worldbuilders either burn out fighting the tool's expectations, or lose track of facts scattered across documents.

---

## 2. Goal

Build a fast, minimal, fact-first worldbuilding app. The core philosophy: **a world is a collection of subjects; a subject is a collection of facts.** No blank pages, no required prose, no templates that go 40 fields deep. Just structured, tagged, searchable facts that can reference each other.

---

## 3. Non-Goals (v1)

- Real-time collaboration or multi-user editing
- Interactive maps
- Timelines / calendars
- Manuscript / prose writing tools
- Data export
- Mobile app (planned for v2)
- Desktop app (planned post-web)

---

## 4. Target Users

Two equal primary personas:

**The Solo Fiction Writer**
Building a world for a novel, short story collection, or personal creative project. Needs to track lore consistency across a complex cast and setting. Frustrated by World Anvil's learning curve and Google Docs' lack of structure. Wants to add facts quickly mid-writing-session without breaking flow.

**The TTRPG Dungeon Master**
Running an ongoing campaign, building homebrew content. Needs to look up facts fast mid-session. Wants to add new facts as they improvise without reorganizing a whole document. Values tags and filtering over prose search.

---

## 5. Data Model

```
Account
└── World (multiple; limited on free tier)
    ├── Categories  (e.g. Characters, Locations, Factions, Items, Spells)
    │   ├── Predefined defaults (can be renamed or deleted)
    │   ├── User-defined custom categories
    │   └── Schema  (set of typed fields defined per category)
    └── Subjects  (e.g. "Aragorn", "Rivendell", "The Order of the Veil")
        ├── Category (one per subject)
        ├── Tags (many, user-defined)
        ├── Schema fields  (structured, consistent across all subjects in the category)
        └── Facts  (ordered list — the primary interaction surface)
            ├── Optional label  (e.g. "Motivation", "History note")
            ├── Content  (short structured note, plain text)
            └── @mentions  (inline links to other Subjects)
```

### Key rules

**Subjects and Facts**
- A **Subject** is the unit of identity — a character, place, faction, spell, concept, etc.
- A **Fact** is the atomic unit of information. Not a prose paragraph — a short note, one to two sentences, with an optional label prefix. Facts are the primary thing you do in this app.
- **Facts are ordered** within a subject. User controls order via drag-and-drop.
- **@mentions** inside fact content auto-link to other subjects. Typing `@` triggers a fuzzy subject search dropdown. When a referenced subject is renamed, all @mentions update automatically.
- **Tags** live on subjects, not facts. User-defined strings for cross-cutting concerns (`#arc-1`, `#deceased`, `#spoiler`). Tags are renameable world-wide in one operation (stored as a normalized table, not as strings on each subject).

**Schema**
- Each **Category** has a **Schema**: a set of typed fields that appear consistently on every subject in that category.
- Schema fields sit in a structured block above the facts list on every subject page.
- Schema is optional — a subject with no filled schema fields and only facts works perfectly fine.
- No schema fields are added to any category by default. Users build schema deliberately.

### Schema field types

| Type | Description | Example |
|---|---|---|
| **List** | Multiple subject references from a specified category | Members → Person; Spells → Spell |
| **Link** | Single subject reference | Mentor → Person; Capital City → Location |
| **Text** | Labeled single-line string | Title, Nickname, True Name |
| **Number** | Numeric value with optional units | Population: 40,000; Age: 87 |
| **Boolean** | Yes/No toggle | Alive, Discovered, Secret |
| **Select** | One choice from a user-defined option list | Status: Active / Disbanded / Destroyed |
| **Multi-select** | Multiple choices from a user-defined option list | Elements: Fire, Shadow |
| **Date** | In-world date (freeform or calendar-relative) | Birthday: 4/27/1304 |
| **Scale** | Numeric slider within a user-defined range | Danger Rating: 1–10; Influence: 1–5 |
| **Color** | Color swatch | Faction color, magic school color |

List and Link fields automatically create **backlinks** — if Aragorn's Mentor field links to Gandalf, Gandalf's subject page shows "Mentored by: Aragorn" in a backlinks section. Backlinks are read-only and auto-maintained.

Date, Scale, and Color fields are available but not added to any default category schema. They exist for users who want them.

---

## 6. Core Features (MVP)

### 6.1 World Management
- Create, name, and switch between worlds
- World-level settings: default categories, tag management
- Free tier: limited number of worlds (exact limit TBD, suggested: 2)
- Paid tier: unlimited worlds

### 6.2 Category Management
- Predefined defaults on world creation: Characters, Locations, Factions, Items, Systems
- User can rename, delete, or reorder categories
- User can create custom categories
- Category has an icon (emoji picker)
- Each category has a **Schema editor**: add, remove, reorder, and configure typed fields
- Schema changes apply to all existing subjects in that category immediately

### 6.3 Templates

Two types of user-created, shareable templates:

**Schema Templates**
- A saved snapshot of a category's schema fields (field names, types, and configuration)
- Example: a "D&D Character" schema template with fields like Class (Select), Level (Number), Spells (List → Spell), Alignment (Select)
- Applying a schema template to a category merges its fields into the existing schema — it does not wipe what's already there
- Users can publish schema templates publicly or keep them private
- Public templates are browsable in a template library within the app

**World Templates**
- A saved snapshot of an entire world's category structure, including each category's schema fields
- Does not include any subjects or facts — structure only
- Example: a "High Fantasy Campaign" world template ships with Categories for Characters, Locations, Factions, Deities, Spells, Items — each with sensible default schema fields already configured
- Applying a world template on new world creation populates the category structure; user can modify before confirming
- Users can publish world templates publicly or keep them private

**Template library**
- Browsable in-app, filterable by genre/use case (fantasy, sci-fi, horror, TTRPG, etc.)
- Community-rated
- One-click apply — no modal, applied inline with a confirmation step

### 6.4 Open Source
- Codebase is public on GitHub for transparency, community trust, and contributions
- Users access the product exclusively via the hosted web app — no self-hosting supported or advertised
- Open source is a credibility and community strategy, not a distribution method

### 6.5 Subject Management
- Create a subject: name + category (required), tags (optional)
- Edit subject name, category, tags at any time
- Archive a subject (soft-delete, recoverable)
- Subject list view within a category: sorted by name or last edited

### 6.6 Fact Entry & Schema Interaction

**Facts-first UX**
- When a subject is open, the cursor is already in the fact input. You just start typing — no clicking, no mode switching.
- Hitting enter commits the fact and opens a new input immediately below.
- Each fact has an optional label prefix (typed as `Label: content` or set after the fact is created).
- Reorder facts via drag-and-drop.
- Edit or delete individual facts inline.
- Facts are stored as **plain text with inline `@{id}` mention markers** (see @mention section below). The referenced subject's name is never stored — only its stable id — and is resolved live at render time. (This supersedes an earlier "hybrid segment object" model; see [ADR 0001](docs/adr/0001-facts-as-plain-text-with-id-markers.md) and design spec §4.1.)

**@mention autocomplete**
- Typing `@` triggers the **mention autocomplete** — a typeahead dropdown showing matching subjects as you type, fuzzy-matched by name.
- Arrow keys + enter (or click) to select. Escape to dismiss.
- Once selected, the `@` and query text are replaced in the UI by the subject name rendered as **bold highlighted text** (a clickable link to that subject). The raw syntax is never visible in read mode.
- **Storage:** mentions are stored as inline `@{id}` markers inside the fact's plain text (`Trained under @{uuid-123}`), where `id` is the subject's stable reference. The subject's name is **never** stored in the fact — not even cached — and is resolved live from the id at display time. This means renaming a subject updates every mention of it everywhere automatically — no find-and-replace, no broken links, no staleness window, no ambiguity between subjects that share a name. See [ADR 0001](docs/adr/0001-facts-as-plain-text-with-id-markers.md).

**`!` field autocomplete**
- Typing `!` triggers the **field autocomplete** — a typeahead dropdown showing matching schema fields for the current subject's category, fuzzy-matched by field name (`!bday` matches `birthday`, `!pop` matches `population`).
- Selecting a field from the autocomplete menu inserts it inline as `!fieldname ` with the cursor ready to type the value.
- Hitting enter fills the schema field. The typed line is consumed — it does not become a fact.
- **If no field matches:** the autocomplete menu shows a "Create new field" option at the bottom. Selecting it shows an inline prompt above the input: `Create "Birthday" · Date — [↵ confirm] [esc cancel]`. Type is auto-detected from the value and correctable before confirming.
- Works for all schema field types. For List/Link: `!members @Aragorn` — the `@` inside the value also triggers mention autocomplete.

**Paid: fact-to-schema detection**
- On the paid tier, when a fact is entered that appears to match a schema field (e.g. "Born on 4/27/1304" when a Birthday field exists), a small inline suggestion appears below the fact: "Convert to Birthday field? [accept] [dismiss]"
- Accepting removes the fact and fills the schema field with the extracted value.
- Detection runs passively after fact entry, never blocking input.

### 6.7 Subject Page Layout

The subject page has a fixed top-to-bottom structure — no tabs, no sidebar switching:

```
[Subject Name — large, editable inline]
[Category type — small label, e.g. "Character"]
[Tags — inline pills, click to add/remove without leaving the page]

─── Schema fields ──────────────────────────────────────
[Field label]  [Value]          ← read-only appearance
[Field label]  [Value]
[+ Add field]                   ← subtle, not a button
────────────────────────────────────────────────────────

─── Facts ──────────────────────────────────────────────
[Label:]  Fact content here with @mention support
[Label:]  Another fact
[         ← active input, cursor here by default      ]
────────────────────────────────────────────────────────

─── Mentioned in ───────────────────────────────────────
[Subject A]  [Subject B]  ...   ← backlinks, deprioritized
────────────────────────────────────────────────────────
```

**Schema field display rules:**
- Filled schema fields are always visible — not collapsed, not hidden behind a toggle.
- Read-only state: label + value displayed cleanly, no visible input box.
- Hover state: a subtle edit affordance appears (underline or faint outline).
- Click: the field drops into inline edit mode in place. No modal.
- Empty schema fields: hidden by default. Revealed via `[+ Add field]` or the `!` command.
- Clicking `[+ Add field]` opens an inline field selector directly in the schema block — not a modal.

### 6.8 Search & Discovery
- Global search bar: searches across all subject names and fact content in the current world. Because facts store `@{id}` markers rather than names, fact search is a **dual match** — resolve the query term to subject ids and match facts referencing those ids, unioned with a literal substring match on the fact text — so a fact that mentions "Gandalf" is found even though the name is not in its stored bytes (ADR 0001)
- Filter by: category, one or more tags
- Combine search + filters
- Tags are scoped per world — not shared across worlds
- Tag browser: see all tags in the current world, how many subjects use each, click to filter
- AI can suggest tags for a subject based on its facts (see section 7)

---

## 7. AI Features

All AI features are opt-in and non-blocking — the app is fully usable without them.

### 7.1 World Q&A
- A chat interface scoped to the current world
- User asks a question ("What do we know about the relationship between Aragorn and Gandalf?") and the AI answers using all facts in the world as context
- Answers cite which subjects and facts were used
- Use case: quick reference during writing or play without manually searching

### 7.2 Contradiction Detection
- Triggered manually by the user (not automatic on every edit)
- Scans all facts across the world and surfaces pairs that appear contradictory
- Presented as a list: "Fact A in Subject X appears to conflict with Fact B in Subject Y"
- User resolves manually — the AI does not auto-correct

### 7.3 Auto-Tag Suggestions
- When a subject has at least 3 facts, AI suggests relevant tags
- Suggestions appear as pills the user can accept or dismiss with one click
- Based on existing tag vocabulary in the world to encourage consistency

### 7.4 AI Tier
- AI features require a paid account (or a limited free-tier usage quota, e.g. 10 Q&A queries/month)
- Model: Claude API (Sonnet tier for cost efficiency)

---

## 8. Platform & Technical Considerations

### 8.1 Phase 1: Web App
- Responsive web app, desktop-first
- Authentication: email/password + Google OAuth
- Data stored server-side (not local-first in v1)
- Real-time save (no manual save button)

### 8.2 Phase 2: Mobile + Cloud Sync
- Native mobile app or high-quality PWA with offline support
- Full sync across devices
- Mobile optimized for reading and quick fact-adding, not heavy editing

### 8.3 Phase 3: Desktop App
- Electron wrapper or Tauri
- Offline-first with sync

---

## 9. Monetization

Open source freemium model. Code is public on GitHub; users access the product via the hosted web app.

| Feature | Free | Paid |
|---|---|---|
| Worlds | 2 | Unlimited |
| Subjects per world | Unlimited | Unlimited |
| Facts per subject | Unlimited | Unlimited |
| Schema fields per category | Unlimited | Unlimited |
| Fact-to-schema auto-detection | ✗ | ✓ |
| AI Q&A | 10 queries/month | Unlimited |
| Contradiction detection | 3 scans/month | Unlimited |
| Auto-tag suggestions | Limited | Unlimited |
| Priority support | ✗ | ✓ |

Pricing target: ~$6–8/month or ~$50/year. Positioned below Campfire ($15/mo) and World Anvil ($8–25/mo).

The free tier is intentionally generous on content (unlimited subjects/facts/schema) but gated on worlds and AI. The goal: users build up a real world on the free tier, hit the world limit, and upgrade to start a second project.

---

## 10. UX Principles

These are non-negotiable design constraints, referenced in every decision:

1. **Facts, not prose.** The app should never push the user toward writing paragraphs. If a UI element makes prose feel natural, it's wrong.
2. **Speed of capture.** Adding a new fact to any subject should be achievable in under 5 seconds from anywhere in the app.
3. **No blank page anxiety.** The default state of a new subject is an empty list — not a blank editor, not a prompt to "write about this character." Empty is fine.
4. **Structure without rigidity.** Categories, schema, and tags are tools, not requirements. A subject with no schema and no tags works perfectly.
5. **AI assists, never drives.** All AI features are pull-based (user-initiated), never push-based (automatic).
6. **No modals or popups.** Nothing should appear floating in front of the screen requiring the user to stop and interact with it before continuing. Confirmations, field creation, renaming, tagging, and all other actions are handled inline or in a contextual side panel. This applies everywhere in the product without exception.

---

## 11. Onboarding

No sample world. No forced interactive tutorial. Instead, a **built-in guide** that:
- Appears as a panel accessible from a persistent help icon (always reachable, never intrusive)
- Shows on first login automatically, dismissable with one click
- Is purely informational — tells the user how things work, doesn't make them perform actions
- Covers: what a world/category/subject/fact is, how `!` commands work, how @mentions work, how schema fields work, what AI features do
- Structured as short sections, skimmable, not a wall of text
- Re-accessible at any time from the help icon — not a one-time thing

The `!` command and schema are intentionally power-user features. They are covered in the guide but not surfaced via hints or tooltips in the UI. Users discover them when they're ready.

---

## 12. Open Questions

- **Fact ordering:** Is drag-and-drop enough, or do users want pinning important facts to the top?

- **✅ RESOLVED — fact storage model (ADR 0001):** Facts are stored as plain text with inline `@{id}` mention markers. The UUID is the stable reference; the subject's name is never stored (not even cached) and resolves live at render time. The earlier "hybrid segment object with cached displayName" idea was rejected in favour of the simpler, staleness-free marker model. Search by mentioned name is handled at query time via a dual match (resolve term → ids → match markers, unioned with literal text match). See [ADR 0001](docs/adr/0001-facts-as-plain-text-with-id-markers.md) and design spec §4.1.

- **Template moderation:** The public template library is community-driven. Is there any moderation, reporting, or quality control, or is it fully open?

---

## 12. Success Metrics (Post-Launch)

- Week-1 retention: % of users who return after first session
- Fact depth: average number of facts per subject (proxy for engagement)
- World completion: % of users who create at least 3 categories with 5+ subjects each
- AI activation rate: % of paid users who use Q&A at least once
- GitHub stars (if open source component exists)
