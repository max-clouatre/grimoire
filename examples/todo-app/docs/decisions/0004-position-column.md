# 0004 · Ordering via a position column

**Status:** Proposed · **Date:** 2026-10-01

## Context
Drag-to-reorder (U5) needs a stable, user-defined order. Today the list is ordered by id.

## Options
1. Integer `position`, renumber on move: simple, O(n) writes per move.
2. Fractional index (string keys between neighbours): one write per move, keys grow over time.

## Proposal
Option 2 using a small fractional-indexing helper; rebalance keys when they exceed 32 characters.

## Open
Needs a migration and a decision before M2 can close.
