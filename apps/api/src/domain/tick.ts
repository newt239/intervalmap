import { and, eq, gt, lte, ne } from "drizzle-orm";

import { disclosures, sessions } from "../db/schema.ts";

import type { DrizzleD1Database } from "drizzle-orm/d1";

// 次回開示時刻を now より後まで進める。Cron 遅延で複数インターバル滞留しても開示は1回に集約する。
// 開示タイミングはサーバーが権威的に決めるプライバシー不変条件の中核。境界値は tick.spec.ts で固定する。
export const advanceNextDisclosureAt = (
  nextDisclosureAt: number,
  intervalSec: number,
  now: number,
): number => {
  if (now < nextDisclosureAt) {
    return nextDisclosureAt;
  }
  const intervalMs = intervalSec * 1000;
  const missed = Math.floor((now - nextDisclosureAt) / intervalMs) + 1;
  return nextDisclosureAt + missed * intervalMs;
};

// 毎分の Cron 本体。開示レコード作成と期限終了をサーバー権威で行う。
export const runScheduledTick = async (db: DrizzleD1Database, now: number): Promise<void> => {
  // 開始時刻を過ぎた scheduled セッションを開始する。
  await db
    .update(sessions)
    .set({ status: "active" })
    .where(
      and(
        eq(sessions.status, "scheduled"),
        lte(sessions.startsAt, now),
        gt(sessions.expiresAt, now),
      ),
    );

  // 期限到達で必ず終了する。無期限追跡を作らない不変条件の実装点。
  await db
    .update(sessions)
    .set({ status: "ended", nextDisclosureAt: null })
    .where(and(ne(sessions.status, "ended"), lte(sessions.expiresAt, now)));

  // 開示時刻に達した active セッションへ disclosure を1件ずつ作成する。
  const due = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.status, "active"), lte(sessions.nextDisclosureAt, now)));

  for (const session of due) {
    if (session.nextDisclosureAt === null) {
      continue;
    }
    await db
      .insert(disclosures)
      .values({ id: crypto.randomUUID(), sessionId: session.id, disclosedAt: now });
    await db
      .update(sessions)
      .set({
        nextDisclosureAt: advanceNextDisclosureAt(
          session.nextDisclosureAt,
          session.intervalSec,
          now,
        ),
      })
      .where(eq(sessions.id, session.id));
  }

  // TODO M5: 開示プッシュのファンアウトと無応答アラート。
};
