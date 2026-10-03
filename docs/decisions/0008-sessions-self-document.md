# 0008 · Projects document themselves in session logs

**Status:** Accepted · **Date:** 2026-10-02

## Context

Boards and roadmaps show *state*; nothing showed *what happened*. Chat transcripts hold the history, but they're per-tool, private and unreadable at a glance. A new agent session starts cold.

## Decision

Each project channel has a sessions folder in its repo, `docs/sessions/`, with one append-only JSON Lines file per day. Three writers keep it current: Claude Code hooks (`start`, `change`, `end`, automatic), the agent via `grim log` (decisions, findings, questions, blockers, done), and the user via the Sessions viewer. A Stop hook sends the agent back once when a turn changed a channel's files without a plain-language entry. The session-start hook feeds today's log back as context.

## Consequences

- The history lives in git next to the code, readable by any agent or person.
- Edits are mapped to channels by path (the deepest folder a channel links to), so logging needs no configuration per project.
- JSONL appends never rewrite history and merge cleanly; coalescing recent `change` entries is the only rewrite, and only of the last line.
- The Stop-hook nudge adds one extra round when the agent forgets to log; it never loops (once per turn, and never when `stop_hook_active`).
