import { useEffect, useState } from "react";
import { TodoItem, type Todo } from "./TodoItem";

export function App() {
  const [items, setItems] = useState<Todo[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => { fetch("/api/todos").then(r => r.json()).then(setItems); }, []);

  // Optimistic: update the UI first, reconcile with the server response (ADR 0002).
  async function add() {
    const title = draft.trim();
    if (!title) return;
    const temp: Todo = { id: -Date.now(), title, done: false, due: null };
    setItems(xs => [temp, ...xs]);
    setDraft("");
    const saved = await (await fetch("/api/todos", { method: "POST", body: JSON.stringify({ title }) })).json();
    setItems(xs => xs.map(x => (x.id === temp.id ? saved : x)));
  }

  return (
    <main>
      <h1>Checkmate</h1>
      <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} placeholder="What needs doing?" />
      <ul>{items.map(t => <TodoItem key={t.id} todo={t} onChange={next => setItems(xs => xs.map(x => (x.id === t.id ? next : x)))} />)}</ul>
    </main>
  );
}
