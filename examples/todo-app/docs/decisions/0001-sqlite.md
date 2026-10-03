# 0001 · SQLite for persistence

**Status:** Accepted · **Date:** 2026-09-10

## Context
v0.1 kept todos in memory and lost them on restart. We need persistence for a single user, with zero ops.

## Decision
Use one SQLite file through `better-sqlite3` (synchronous, fast, no server).

## Consequences
- Trivial backups (copy one file) and fast tests (`:memory:`).
- No multi-user story; fine given ADR 0003.
- Offline mode will need a separate client store (IndexedDB) and sync.
