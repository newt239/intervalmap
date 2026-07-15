import { eq } from "drizzle-orm";

import { sessions, type SessionRow } from "../db/schema.ts";

import type { DrizzleD1Database } from "drizzle-orm/d1";

// 期限・開始時刻からの権威的なステータス判定。期限判定は expires_at ちょうどを含む。無期限追跡は作らない。
export const resolveSessionStatus = (session: SessionRow, now: number): SessionRow["status"] => {
  if (session.status !== "ended" && now >= session.expiresAt) {
    return "ended";
  }
  if (session.status === "scheduled" && now >= session.startsAt) {
    return "active";
  }
  return session.status;
};

// Cron の隙間でも期限後の追跡を許さないための遅延反映。不変条件の二重化。
export const reconcileSessionStatus = async (
  db: DrizzleD1Database,
  session: SessionRow,
  now: number,
): Promise<SessionRow> => {
  const resolved = resolveSessionStatus(session, now);
  if (resolved === session.status) {
    return session;
  }
  if (resolved === "ended") {
    await db
      .update(sessions)
      .set({ status: "ended", nextDisclosureAt: null, endedAt: now })
      .where(eq(sessions.id, session.id));
    return { ...session, status: "ended", nextDisclosureAt: null, endedAt: now };
  }
  await db.update(sessions).set({ status: resolved }).where(eq(sessions.id, session.id));
  return { ...session, status: resolved };
};
