import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

import { registerUserInputSchema, updateUserInputSchema } from "@intervalmap/shared";

import { users } from "../db/schema.ts";
import { jsonError } from "../lib/http-error.ts";
import { requireAuth } from "../middleware/auth.ts";

import type { AuthEnv } from "../middleware/auth.ts";

import type { AuthResponse, UserResponse } from "@intervalmap/shared";

export const usersRoute = new Hono<AuthEnv>()
  // 匿名デバイス認証のユーザー登録。初回起動時に1回だけ呼ばれる想定。
  .post("/", async (c) => {
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
  })

  // 表示名の更新。トークンは再発行しない。
  .patch("/me", requireAuth, async (c) => {
    const parsed = updateUserInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(c, 400, "invalid_request", "リクエストボディが不正です");
    }
    const user = c.get("user");
    const db = drizzle(c.env.DB);
    await db
      .update(users)
      .set({ displayName: parsed.data.displayName })
      .where(eq(users.id, user.id));

    const body: UserResponse = {
      user: { id: user.id, displayName: parsed.data.displayName, createdAt: user.createdAt },
    };
    return c.json(body);
  });
