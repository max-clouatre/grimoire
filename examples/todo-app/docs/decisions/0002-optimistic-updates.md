# 0002 · Optimistic updates with server reconciliation

**Status:** Accepted · **Date:** 2026-09-24

## Context
Goal #1 is speed: waiting on the network to show a new task feels slow. But in 0.2 a race let a stale list response overwrite a just-completed item ("completed items reappear").

## Decision
Apply changes to UI state immediately with a temporary id; replace the temporary item with the server's response. List refreshes merge by id and never overwrite items with pending writes.

## Consequences
- The UI feels instant.
- Failed writes must roll back visibly; we show a toast and restore the previous state.
