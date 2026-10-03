# 0007 · Bind to localhost only

**Status:** Accepted · **Date:** 2026-10-02

## Context

Links can point at anything on disk, including private folders.

## Decision

The server listens on `127.0.0.1`. There is no auth because nothing off-machine can connect.

## Consequences

- Viewing Grimoire from a phone or another computer needs a deliberate change (a tunnel plus a token), which we haven't built.
