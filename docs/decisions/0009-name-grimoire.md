# 0009 · The name is Grimoire

**Status:** Accepted · **Date:** 2026-10-02

## Context

The working name "tv" came from Television, our inspiration. The concept has since diverged: files as the interface, project channels, two-way pages, self-writing sessions. It deserved its own name.

## Decision

**Grimoire**, a book of spells. Agent skills are spells, artifacts are pages, sessions write the history. The command is **grim**, the workspace folder `.grimoire/`, the code folder `grimoire/`, the page API `window.grim`. Considered: Glance (already a popular dashboard), Tome, Lore, Quire, Folio, Storybook (taken by the UI tool).

## Consequences

- Everything was renamed in one pass (folders, URLs, API, skill, docs, card ids `grim-NNN`).
- `grim` clashes with a Wayland screenshot tool on Linux; the package also installs `grimoire` as a full-length command.
- Credit to Television stays in the README and docs.
