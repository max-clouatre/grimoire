# Checkmate · Product requirements

**Owner:** Max · **Status:** v1 in progress · **Last updated:** 2026-10-01

## Problem

Most todo apps grow into project managers. People who want a single, fast list end up fighting projects, labels and sync settings. Checkmate is the opposite: one list that opens instantly and is driven from the keyboard.

## Goals

1. Capture a task in under two seconds from opening the app.
2. Everything reachable from the keyboard.
3. Works offline; nothing is lost on refresh.

**Non-goals for v1:** accounts, sharing, multiple lists, recurring tasks (see ADR 0003).

## Users

- **The quick capturer:** jots things down mid-meeting; cares about speed above everything.
- **The daily planner:** reviews the list each morning; cares about due dates and what's overdue.

## User stories

| # | As a… | I want to… | So that… | Status |
|---|---|---|---|---|
| U1 | capturer | add a task by typing and pressing Enter | I never touch the mouse | ✅ shipped |
| U2 | capturer | toggle, edit and delete with single keys | triage is fast | ✅ shipped |
| U3 | planner | give a task a due date | I see what's urgent | ✅ shipped |
| U4 | planner | see overdue tasks highlighted | nothing slips | ✅ shipped |
| U5 | planner | reorder tasks by dragging | the list reflects my priorities | 🟡 in progress |
| U6 | capturer | use it with no connection | it works on a train | ⚪ planned |
| U7 | anyone | export my list as Markdown | I own my data | ⚪ planned |

## Success metrics

- Median time from page load to first task added < 2 s
- ≥ 80% of actions taken via keyboard among returning users
- Zero data-loss reports

## Open questions

- [ ] Do we need undo for delete, or is "clear completed" confirmation enough?
- [ ] Should due dates support times, or dates only?
- [x] SQLite or IndexedDB for v1? → SQLite on the server (ADR 0001); IndexedDB arrives with offline mode.
