export interface Todo { id: number; title: string; done: boolean; due: string | null }

export function TodoItem({ todo, onChange }: { todo: Todo; onChange: (t: Todo) => void }) {
  const overdue = todo.due && !todo.done && todo.due < new Date().toISOString().slice(0, 10);
  async function toggle() {
    const next = { ...todo, done: !todo.done };
    onChange(next);
    await fetch(`/api/todos/${todo.id}`, { method: "PATCH", body: JSON.stringify({ done: next.done }) });
  }
  return (
    <li className={todo.done ? "done" : ""}>
      <input type="checkbox" checked={todo.done} onChange={toggle} />
      {todo.title}
      {todo.due && <span className={overdue ? "badge overdue" : "badge"}>{todo.due}</span>}
    </li>
  );
}
