import Database from "better-sqlite3";

export interface Todo { id: number; title: string; done: boolean; due: string | null; createdAt: string }

const db = new Database(process.env.CHECKMATE_DB ?? "checkmate.db");
db.exec(`CREATE TABLE IF NOT EXISTS todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  done INTEGER NOT NULL DEFAULT 0,
  due TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

const row = (r: any): Todo => ({ id: r.id, title: r.title, done: !!r.done, due: r.due, createdAt: r.created_at });

export const todos = {
  list: () => db.prepare("SELECT * FROM todos ORDER BY id DESC").all().map(row),
  create: (title: string, due: string | null = null) =>
    row(db.prepare("INSERT INTO todos (title, due) VALUES (?, ?) RETURNING *").get(title, due)),
  update: (id: number, patch: Partial<Pick<Todo, "title" | "done" | "due">>) => {
    const cur = db.prepare("SELECT * FROM todos WHERE id = ?").get(id);
    if (!cur) return null;
    const next = { ...row(cur), ...patch };
    db.prepare("UPDATE todos SET title = ?, done = ?, due = ? WHERE id = ?").run(next.title, next.done ? 1 : 0, next.due, id);
    return next;
  },
  remove: (id: number) => db.prepare("DELETE FROM todos WHERE id = ?").run(id).changes > 0,
  clearCompleted: () => db.prepare("DELETE FROM todos WHERE done = 1").run().changes,
};
