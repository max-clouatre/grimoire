import { Hono } from "hono";
import { todos } from "../db";

export const todoRoutes = new Hono()
  .get("/", c => c.json(todos.list()))
  .post("/", async c => {
    const { title, due } = await c.req.json();
    if (typeof title !== "string" || !title.trim()) return c.json({ error: "title required" }, 400);
    return c.json(todos.create(title.trim(), due ?? null), 201);
  })
  .patch("/:id", async c => {
    const updated = todos.update(Number(c.req.param("id")), await c.req.json());
    return updated ? c.json(updated) : c.json({ error: "not found" }, 404);
  })
  .delete("/completed", c => c.json({ removed: todos.clearCompleted() }))
  .delete("/:id", c => (todos.remove(Number(c.req.param("id"))) ? c.body(null, 204) : c.json({ error: "not found" }, 404)));
