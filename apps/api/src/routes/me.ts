import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

import { registerPushTokenInputSchema, type RegisterPushTokenResponse } from "@intervalmap/shared";

import { pushTokens } from "../db/schema.ts";
import { jsonError } from "../lib/http-error.ts";
import { requireAuth, type AuthEnv } from "../middleware/auth.ts";

export const meRoute = new Hono<AuthEnv>()
  .use(requireAuth)

  // Expo Push token の登録。同一ユーザー・同一トークンは更新のみで重複させない。
  .put("/push-token", async (c) => {
    const parsed = registerPushTokenInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(c, 400, "invalid_request", "リクエストボディが不正です");
    }
    const user = c.get("user");
    const db = drizzle(c.env.DB);
    const now = Date.now();

    const [existing] = await db
      .select()
      .from(pushTokens)
      .where(
        and(
          eq(pushTokens.userId, user.id),
          eq(pushTokens.expoPushToken, parsed.data.expoPushToken),
        ),
      )
      .limit(1);
    if (existing) {
      await db
        .update(pushTokens)
        .set({ platform: parsed.data.platform, updatedAt: now })
        .where(eq(pushTokens.id, existing.id));
    } else {
      await db.insert(pushTokens).values({
        id: crypto.randomUUID(),
        userId: user.id,
        expoPushToken: parsed.data.expoPushToken,
        platform: parsed.data.platform,
        updatedAt: now,
      });
    }

    const body: RegisterPushTokenResponse = { ok: true };
    return c.json(body);
  });
