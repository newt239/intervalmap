import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

import { runScheduledTick } from "./domain/tick.ts";
import { meRoute } from "./routes/me.ts";
import { sessionsRoute } from "./routes/sessions.ts";
import { usersRoute } from "./routes/users.ts";

import type { Env } from "./env.ts";

// intervalmap API のエントリポイント。
const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => c.json({ ok: true, service: "intervalmap-api" }));

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/users", usersRoute);
app.route("/sessions", sessionsRoute);
app.route("/me", meRoute);

export default {
  fetch: app.fetch,

  // 毎分の Cron。開示レコード作成と期限終了をサーバー権威で行う。
  scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduledTick(drizzle(env.DB), Date.now()));
  },
};
