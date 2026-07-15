import { desc, eq } from "drizzle-orm";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { Hono } from "hono";

import {
  createInviteInputSchema,
  INVITE_ALPHABET,
  INVITE_CODE_LENGTH,
  type Invite,
  type InviteListResponse,
  type InviteResponse,
} from "@intervalmap/shared";

import { invites, sessions, type InviteRow, type SessionRow } from "../db/schema.ts";
import { reconcileSessionStatus } from "../domain/session-status.ts";
import { jsonError } from "../lib/http-error.ts";
import { requireAuth, type AuthEnv } from "../middleware/auth.ts";

export const newInviteCode = (): string => {
  const bytes = new Uint8Array(INVITE_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => INVITE_ALPHABET.charAt(b % INVITE_ALPHABET.length)).join("");
};

const toInviteDto = (row: InviteRow): Invite => ({
  id: row.id,
  sessionId: row.sessionId,
  code: row.code,
  allowSharing: row.allowSharing,
  allowViewing: row.allowViewing,
  revokedAt: row.revokedAt,
  createdAt: row.createdAt,
});

const findSessionById = async (db: DrizzleD1Database, id: string): Promise<SessionRow | null> => {
  const [row] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  return row ?? null;
};

// 招待の発行・一覧・失効。すべて主催者のみ。
export const invitesRoute = new Hono<AuthEnv>()
  .use(requireAuth)

  // 招待の発行。終了済みセッションには発行できない。
  .post("/:id/invites", async (c) => {
    const parsed = createInviteInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(c, 400, "invalid_request", "リクエストボディが不正です");
    }
    const user = c.get("user");
    const db = drizzle(c.env.DB);
    const now = Date.now();

    const found = await findSessionById(db, c.req.param("id"));
    if (!found) {
      return jsonError(c, 404, "session_not_found", "セッションが見つかりません");
    }
    if (found.ownerId !== user.id) {
      return jsonError(c, 403, "not_owner", "主催者のみ招待を発行できます");
    }
    const session = await reconcileSessionStatus(db, found, now);
    if (session.status === "ended") {
      return jsonError(c, 410, "session_ended", "このセッションは終了しています");
    }

    // 招待コードの unique 衝突に備えて数回リトライする。
    let inviteRow: InviteRow | null = null;
    for (let attempt = 0; attempt < 3 && inviteRow === null; attempt++) {
      const candidate: InviteRow = {
        id: crypto.randomUUID(),
        sessionId: session.id,
        code: newInviteCode(),
        allowSharing: parsed.data.allowSharing,
        allowViewing: parsed.data.allowViewing,
        revokedAt: null,
        createdAt: now,
      };
      try {
        await db.insert(invites).values(candidate);
        inviteRow = candidate;
      } catch {
        // unique 制約違反とみなして再試行する。
      }
    }
    if (inviteRow === null) {
      return jsonError(c, 500, "invite_create_failed", "招待を発行できませんでした");
    }

    const body: InviteResponse = { invite: toInviteDto(inviteRow) };
    return c.json(body, 201);
  })

  // 招待の一覧。失効済みも含めて返す。
  .get("/:id/invites", async (c) => {
    const user = c.get("user");
    const db = drizzle(c.env.DB);

    const found = await findSessionById(db, c.req.param("id"));
    if (!found) {
      return jsonError(c, 404, "session_not_found", "セッションが見つかりません");
    }
    if (found.ownerId !== user.id) {
      return jsonError(c, 403, "not_owner", "主催者のみ招待を閲覧できます");
    }

    const rows = await db
      .select()
      .from(invites)
      .where(eq(invites.sessionId, found.id))
      .orderBy(desc(invites.createdAt));

    const body: InviteListResponse = { invites: rows.map((row) => toInviteDto(row)) };
    return c.json(body);
  })

  // 招待の失効。失効済みへの再実行は冪等に成功する。
  .delete("/:id/invites/:inviteId", async (c) => {
    const user = c.get("user");
    const db = drizzle(c.env.DB);
    const now = Date.now();

    const found = await findSessionById(db, c.req.param("id"));
    if (!found) {
      return jsonError(c, 404, "session_not_found", "セッションが見つかりません");
    }
    if (found.ownerId !== user.id) {
      return jsonError(c, 403, "not_owner", "主催者のみ招待を失効できます");
    }
    const [invite] = await db
      .select()
      .from(invites)
      .where(eq(invites.id, c.req.param("inviteId")))
      .limit(1);
    if (!invite || invite.sessionId !== found.id) {
      return jsonError(c, 404, "invite_not_found", "招待が見つかりません");
    }

    const revokedAt = invite.revokedAt ?? now;
    if (invite.revokedAt === null) {
      await db.update(invites).set({ revokedAt }).where(eq(invites.id, invite.id));
    }

    const body: InviteResponse = { invite: toInviteDto({ ...invite, revokedAt }) };
    return c.json(body);
  });
