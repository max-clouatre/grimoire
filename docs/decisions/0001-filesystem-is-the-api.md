# 0001 · The filesystem is the API

**Status:** Accepted · **Date:** 2026-10-02

## Context

Television gives agents a `Grimoire` CLI and a server-side registry. We wanted the same experience with less machinery, and something any agent can use without installation, including agents that only have file tools.

## Decision

The folder `.grimoire/` is the whole interface. A channel is a folder, an artifact is a file, order is a number prefix, focus is `focus.json`, the theme is `settings.json`. There is no CLI and no write API for agents.

## Consequences

- Any agent that can write files can drive Grimoire; the skill is just documentation of conventions.
- State is inspectable, diffable and versionable with ordinary tools.
- Renames change identity: an artifact's id *is* its filename, so reordering by renaming must carry layout entries along (see board card grim-024).
- Concurrent writers (agent and UI) can race on the same file; acceptable for a single-user local tool.
