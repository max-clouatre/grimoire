# 0004 · Focus lives in a file both sides write

**Status:** Accepted · **Date:** 2026-10-02

## Context

Television separates *creating* an artifact from *moving the user's attention* to it. Agents also benefit from knowing what the user is looking at.

## Decision

`.grimoire/focus.json` holds `{ channel, artifact }`. Agents write it to move attention; the UI writes it whenever the user switches channel or tab (with `"by": "ui"`).

## Consequences

- An agent can read what the user is looking at and answer "this" questions.
- All open windows follow the same focus. Television keeps tab selection per-window; we accept the difference for a single-user tool.
