import { and, eq, gt, inArray, isNotNull, lte, ne, notExists, sql } from "drizzle-orm";

import {
  DEFAULT_HISTORY_RETENTION_DAYS,
  NO_RESPONSE_ALERT_COOLDOWN_SEC,
  NO_RESPONSE_INTERVAL_MULTIPLIER,
} from "@intervalmap/shared";

import {
  alerts,
  disclosures,
  locationPoints,
  memberships,
  pushTokens,
  sessions,
  users,
  type SessionRow,
} from "../db/schema.ts";
import { sendExpoPush, type PushSender } from "../lib/expo-push.ts";

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

// セッション全メンバーの Expo Push token を集める。
const findMemberPushTokens = async (
  db: DrizzleD1Database,
  sessionId: string,
): Promise<string[]> => {
  const rows = await db
    .select({ expoPushToken: pushTokens.expoPushToken })
    .from(memberships)
    .innerJoin(pushTokens, eq(memberships.userId, pushTokens.userId))
    .where(eq(memberships.sessionId, sessionId));
  return rows.map((r) => r.expoPushToken);
};

// セッション終了を全メンバーへ一度だけ通知する。alerts の session_end 行を重複防止の台帳にする。
export const notifySessionEnd = async (
  db: DrizzleD1Database,
  session: SessionRow,
  now: number,
  sendPush: PushSender = sendExpoPush,
): Promise<void> => {
  const [already] = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.sessionId, session.id), eq(alerts.type, "session_end")))
    .limit(1);
  if (already) {
    return;
  }
  await db
    .insert(alerts)
    .values({ id: crypto.randomUUID(), sessionId: session.id, type: "session_end", firedAt: now });
  const tokens = await findMemberPushTokens(db, session.id);
  if (tokens.length > 0) {
    await sendPush(
      tokens.map((to) => ({
        to,
        title: session.title,
        body: "セッションが終了し、位置共有は停止しました",
        data: { sessionId: session.id },
      })),
    );
  }
};

// 毎分の Cron 本体。開示・期限終了・無応答アラート・履歴削除をサーバー権威で行う。
export const runScheduledTick = async (
  db: DrizzleD1Database,
  now: number,
  sendPush: PushSender = sendExpoPush,
): Promise<void> => {
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
    .set({ status: "ended", nextDisclosureAt: null, endedAt: now })
    .where(and(ne(sessions.status, "ended"), lte(sessions.expiresAt, now)));

  // 終了通知が未送のセッションへ送る。手動終了や遅延反映で終了した分もここで拾う。
  const endedPending = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.status, "ended"),
        isNotNull(sessions.endedAt),
        notExists(
          db
            .select()
            .from(alerts)
            .where(and(eq(alerts.sessionId, sessions.id), eq(alerts.type, "session_end"))),
        ),
      ),
    );
  for (const session of endedPending) {
    await notifySessionEnd(db, session, now, sendPush);
  }

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

    // 開示プッシュのファンアウト。受信したクライアントは地図を再取得する。
    const tokens = await findMemberPushTokens(db, session.id);
    if (tokens.length > 0) {
      await sendPush(
        tokens.map((to) => ({
          to,
          title: session.title,
          body: "位置が開示されました",
          data: { sessionId: session.id },
        })),
      );
    }
  }

  // 無応答アラート。共有オンなのに interval×3 を超えて位置が届かないメンバーを主催者へ通知する。
  const active = await db.select().from(sessions).where(eq(sessions.status, "active"));
  for (const session of active) {
    const staleThreshold = now - session.intervalSec * NO_RESPONSE_INTERVAL_MULTIPLIER * 1000;
    const stale = await db
      .select({ membership: memberships, displayName: users.displayName })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(
        and(
          eq(memberships.sessionId, session.id),
          eq(memberships.sharingEnabled, true),
          isNotNull(memberships.lastUploadedAt),
          lte(memberships.lastUploadedAt, staleThreshold),
        ),
      );
    if (stale.length === 0) {
      continue;
    }
    const ownerTokens = await db
      .select({ expoPushToken: pushTokens.expoPushToken })
      .from(pushTokens)
      .where(eq(pushTokens.userId, session.ownerId));
    for (const { membership, displayName } of stale) {
      // クールダウン内の再発火を抑止する。
      const [recent] = await db
        .select()
        .from(alerts)
        .where(
          and(
            eq(alerts.membershipId, membership.id),
            eq(alerts.type, "no_response"),
            gt(alerts.firedAt, now - NO_RESPONSE_ALERT_COOLDOWN_SEC * 1000),
          ),
        )
        .limit(1);
      if (recent) {
        continue;
      }
      await db.insert(alerts).values({
        id: crypto.randomUUID(),
        sessionId: session.id,
        membershipId: membership.id,
        type: "no_response",
        firedAt: now,
      });
      if (ownerTokens.length > 0) {
        await sendPush(
          ownerTokens.map((t) => ({
            to: t.expoPushToken,
            title: session.title,
            body: `${displayName}さんの位置情報が届いていません`,
            data: { sessionId: session.id },
          })),
        );
      }
    }
  }

  // 監視しない見守り。終了から保持期間を過ぎたセッションの位置履歴を自動削除する不変条件。
  const retentionCutoff = now - DEFAULT_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const purgeable = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.status, "ended"),
        lte(sql`coalesce(${sessions.endedAt}, ${sessions.expiresAt})`, retentionCutoff),
      ),
    );
  if (purgeable.length > 0) {
    await db.delete(locationPoints).where(
      inArray(
        locationPoints.sessionId,
        purgeable.map((s) => s.id),
      ),
    );
  }
};
