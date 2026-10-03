import { describe, expect, it } from "vitest";
import { todoRoutes } from "../src/routes/todos";

describe("/api/todos", () => {
  it("creates and lists a todo", async () => {
    const res = await todoRoutes.request("/", { method: "POST", body: JSON.stringify({ title: "Buy milk" }) });
    expect(res.status).toBe(201);
    const list = await (await todoRoutes.request("/")).json();
    expect(list[0].title).toBe("Buy milk");
  });
  it("rejects an empty title", async () => {
    const res = await todoRoutes.request("/", { method: "POST", body: JSON.stringify({ title: "  " }) });
    expect(res.status).toBe(400);
  });
});
