# Architecture

Checkmate is a small client–server app: a React UI talks JSON to a Hono API backed by one SQLite file.

```
 ┌──────────── browser ────────────┐        ┌──────────── server ────────────┐
 │  App.tsx                        │  HTTP  │  server.ts (Hono, :3001)        │
 │   ├─ optimistic state           │ ─────► │   └─ routes/todos.ts            │
 │   └─ TodoItem.tsx               │  JSON  │        └─ db.ts ──► checkmate.db│
 │  (M3: service worker + IDB)     │ ◄───── │           (better-sqlite3)      │
 └─────────────────────────────────┘        └────────────────────────────────┘
```

## API

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/todos` | — | `Todo[]`, newest first |
| POST | `/api/todos` | `{ title, due? }` | `201 Todo` · `400` if title empty |
| PATCH | `/api/todos/:id` | `{ title?, done?, due? }` | `Todo` · `404` |
| DELETE | `/api/todos/:id` | — | `204` · `404` |
| DELETE | `/api/todos/completed` | — | `{ removed }` |

## Data

```sql
todos(id INTEGER PK, title TEXT 1..200, done INTEGER 0/1, due TEXT NULL, created_at TEXT)
```

## Key choices

- **Optimistic updates** in the UI, reconciled with the server's response ([ADR 0002](decisions/0002-optimistic-updates.md)).
- **One SQLite file**, synchronous driver: simple and fast at this scale ([ADR 0001](decisions/0001-sqlite.md)).
- **No accounts in v1** ([ADR 0003](decisions/0003-no-accounts-v1.md)).

## Risks

- Offline mode (M3) introduces a sync queue and conflict rules: the largest design change still ahead.
- Drag-to-reorder needs a `position` column and a migration.
