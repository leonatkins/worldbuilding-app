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
A user-defined label applied to subjects for cross-cutting concerns (e.g. `#deceased`, `#arc-1`). Scoped to a world; renameable in one operation. Lives on subjects, not facts.
_Avoid_: Label, category (different concept)

**Mention**:
A reference from inside a fact to another subject, identified by that subject's
stable id and never by its name; it renders live as the subject's current name
and drives backlinks. (List and Link schema fields create the same kind of
reference by other means.)
_Avoid_: Reference, tag, backlink (backlink is the *inbound* view of a mention)
