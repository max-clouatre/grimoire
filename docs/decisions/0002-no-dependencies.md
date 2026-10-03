# 0002 · No dependencies

**Status:** Accepted · **Date:** 2026-10-02

## Context

Grimoire should start with one command on any machine with Node, including Windows where Television's agent side is unsupported.

## Decision

Use only Node built-ins (`http`, `fs.watch`, `path`) and plain browser APIs. Write a small Markdown renderer instead of importing one.

## Consequences

- `node grimoire/server.mjs` is the entire install.
- We own ~200 lines of Markdown parsing; edge cases (nested blockquotes in lists, reference links) are unsupported.
- No syntax highlighter yet; that would be the first dependency worth reconsidering.
