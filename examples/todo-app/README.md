# Checkmate

A tiny, fast todo app: one list, keyboard-first, works offline. *(Sample project used to demo Grimoire's project channels. The code is illustrative.)*

```bash
npm install
npm run dev      # API on :3001, web on :5173
npm test
```

## Structure

| Path | What |
|---|---|
| `src/server.ts` | HTTP server (Hono) and route wiring |
| `src/db.ts` | SQLite access via better-sqlite3 |
| `src/routes/todos.ts` | `/api/todos` CRUD |
| `src/web/` | React UI: `App.tsx`, `TodoItem.tsx` |
| `tests/` | API tests (Vitest) |
| `docs/` | PRD, roadmap, architecture, decisions, board |
| `prototype/` | Clickable prototype (a Grimoire two-way artifact) |
