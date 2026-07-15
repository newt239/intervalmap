import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

import { runScheduledTick } from "./domain/tick.ts";
import { invitesRoute } from "./routes/invites.ts";
import { meRoute } from "./routes/me.ts";
import { publicRoute } from "./routes/public.ts";
import { sessionsRoute } from "./routes/sessions.ts";
import { usersRoute } from "./routes/users.ts";

import type { Env } from "./env.ts";

// intervalmap API のエントリポイント。
const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => c.json({ ok: true, service: "intervalmap-api" }));

app.get("/health", (c) => c.json({ status: "ok" }));

// /join と /.well-known を占有する。今後の API ルートとパスを衝突させないこと。
app.route("/", publicRoute);

app.route("/users", usersRoute);
app.route("/sessions", invitesRoute);
app.route("/sessions", sessionsRoute);
app.route("/me", meRoute);

export default {
  fetch: app.fetch,

  // 毎分の Cron。開示レコード作成と期限終了をサーバー権威で行う。
  scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduledTick(drizzle(env.DB), Date.now()));
  },
};
