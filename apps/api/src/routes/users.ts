import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

import { registerUserInputSchema } from "@intervalmap/shared";

import { users } from "../db/schema.ts";
import { jsonError } from "../lib/http-error.ts";

import type { Env } from "../env.ts";

import type { AuthResponse } from "@intervalmap/shared";

// 匿名デバイス認証のユーザー登録。初回起動時に1回だけ呼ばれる想定。
export const usersRoute = new Hono<{ Bindings: Env }>().post("/", async (c) => {
  const parsed = registerUserInputSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(c, 400, "invalid_request", "リクエストボディが不正です");
  }

  // ベアラートークンは32バイトの CSPRNG を hex 化して発行する。
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const row = {
    id: crypto.randomUUID(),
    displayName: parsed.data.displayName,
    authToken: Array.from(tokenBytes, (b) => b.toString(16).padStart(2, "0")).join(""),
    createdAt: Date.now(),
  };
  const db = drizzle(c.env.DB);
  await db.insert(users).values(row);

  const body: AuthResponse = {
    user: { id: row.id, displayName: row.displayName, createdAt: row.createdAt },
    token: row.authToken,
  };
  return c.json(body, 201);
});
