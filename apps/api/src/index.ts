import { Hono } from "hono";

import type { Env } from "./env.ts";

// intervalmap API のエントリポイント。M0 は Hello World と health のみ。
const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => c.json({ ok: true, service: "intervalmap-api" }));

app.get("/health", (c) => c.json({ status: "ok" }));

export default {
  fetch: app.fetch,

  // 毎分の Cron 受け口。開示処理・期限終了・無応答アラートは M2 で実装する。
  scheduled(_event: ScheduledController, _env: Env, _ctx: ExecutionContext) {
    // 本実装は M2。
  },
};
