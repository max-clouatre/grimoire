# 0003 · Artifacts are pointers

**Status:** Accepted · **Date:** 2026-10-02

## Context

Project docs belong in their repo, next to the code, under version control. Copying them into `.grimoire/` would create two sources of truth.

## Decision

A `.link` file holds one path (relative to the link) or URL. Grimoire renders the target and watches it. Folders without `index.html` render as a repo view.

## Consequences

- Project channels are mostly `.link` files into `docs/`; edits happen in the repo.
- Deleting a `.link` is always safe. Deleting an `.html`/`.md` that lives inside `.grimoire/` deletes content, so the skill tells agents to ask first.
- Two-way artifacts can write into linked repos, so writes are tightly scoped (0006).
