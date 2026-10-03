import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { todoRoutes } from "./routes/todos";

const app = new Hono().route("/api/todos", todoRoutes);
serve({ fetch: app.fetch, port: 3001 });
console.log("checkmate api on http://localhost:3001");
