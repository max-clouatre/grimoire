# 0006 · Two-way writes are scoped to data files

**Status:** Accepted · **Date:** 2026-10-02

## Context

Interactive artifacts (boards, checklists, prototypes) are far more useful when they can save. But an artifact page is HTML/JS we serve on localhost, and links point into real repos.

## Decision

Artifacts write with `PUT` to their own URL space, via `window.grim`. The server accepts a write only if it has the `x-grim: 1` header and a Grimoire origin, stays inside the artifact's base folder, targets `.json .md .txt .csv .yml .yaml`, and isn't a secret-looking file. JSON must parse.

## Consequences

- Other websites can't write (the custom header forces a CORS preflight we don't answer).
- Artifacts can't rewrite code or HTML, including their own page.
- The agent sees user edits as ordinary file changes in the repo, so `git diff` shows exactly what the user did on the board.
