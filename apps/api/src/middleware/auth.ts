import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { createMiddleware } from "hono/factory";

import { users } from "../db/schema.ts";
import { jsonError } from "../lib/http-error.ts";

import type { UserRow } from "../db/schema.ts";
import type { Env } from "../env.ts";

// 匿名デバイス認証。Authorization: Bearer <token> で users.auth_token と突合する。
export type AuthEnv = { Bindings: Env; Variables: { user: UserRow } };

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const header = c.req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) {
    return jsonError(c, 401, "unauthorized", "認証トークンが必要です");
  }
  const db = drizzle(c.env.DB);
  const [user] = await db.select().from(users).where(eq(users.authToken, token)).limit(1);
  if (!user) {
    return jsonError(c, 401, "unauthorized", "認証トークンが無効です");
  }
  c.set("user", user);
  await next();
});
