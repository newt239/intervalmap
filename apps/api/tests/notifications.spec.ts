import { env, SELF } from "cloudflare:test";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { describe, expect, it } from "vitest";

import { alerts, locationPoints, memberships, pushTokens, sessions } from "../src/db/schema.ts";
import { runScheduledTick } from "../src/domain/tick.ts";

import type { PushMessage } from "../src/lib/expo-push.ts";

import type {
  AuthResponse,
  InviteResponse,
  SessionWithMembershipResponse,
} from "@intervalmap/shared";

// M5 見守り機能の統合テスト。
// 1. 開示プッシュのファンアウト
// 2. 終了通知は alerts を台帳に一度だけ送る
// 3. 無応答アラートはクールダウンで連続発火しない
// 4. 終了から保持期間を過ぎた位置履歴は自動削除する

const registerUser = async (displayName: string): Promise<AuthResponse> => {
  const res = await SELF.fetch("https://example.com/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  });
  expect(res.status).toBe(201);
  return res.json();
};

const authedFetch = async (token: string, path: string, init?: RequestInit) =>
  SELF.fetch(`https://example.com${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

const createSession = async (token: string): Promise<SessionWithMembershipResponse> => {
  const res = await authedFetch(token, "/sessions", {
    method: "POST",
    body: JSON.stringify({ title: "テスト", intervalSec: 60, durationSec: 3600 }),
  });
  expect(res.status).toBe(201);
  return res.json();
};

const registerPushToken = async (token: string, expoPushToken: string) => {
  const res = await authedFetch(token, "/me/push-token", {
    method: "PUT",
    body: JSON.stringify({ expoPushToken, platform: "ios" }),
  });
  expect(res.status).toBe(200);
};

// テスト用のプッシュ送信スタブ。送ったメッセージを配列に集める。
const collectPush = (sink: PushMessage[]) => async (messages: PushMessage[]) => {
  sink.push(...messages);
};

describe("PUT /me/push-token", () => {
  it("登録できて同一トークンは重複しない", async () => {
    const user = await registerUser("通知ユーザー");
    await registerPushToken(user.token, "ExponentPushToken[aaa]");
    await registerPushToken(user.token, "ExponentPushToken[aaa]");
    await registerPushToken(user.token, "ExponentPushToken[bbb]");

    const db = drizzle(env.DB);
    const rows = await db.select().from(pushTokens).where(eq(pushTokens.userId, user.user.id));
    expect(rows.map((r) => r.expoPushToken).toSorted()).toEqual([
      "ExponentPushToken[aaa]",
      "ExponentPushToken[bbb]",
    ]);
  });

  it("認証なしは 401", async () => {
    const res = await SELF.fetch("https://example.com/me/push-token", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expoPushToken: "x", platform: "ios" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("開示プッシュ", () => {
  it("開示時に全メンバーへプッシュされる", async () => {
    const owner = await registerUser("主催者");
    const member = await registerUser("参加者");
    const created = await createSession(owner.token);
    const inviteRes = await authedFetch(owner.token, `/sessions/${created.session.id}/invites`, {
      method: "POST",
      body: JSON.stringify({ allowSharing: true, allowViewing: true }),
    });
    const { invite }: InviteResponse = await inviteRes.json();
    await authedFetch(member.token, "/sessions/join", {
      method: "POST",
      body: JSON.stringify({ inviteCode: invite.code }),
    });
    await registerPushToken(owner.token, "ExponentPushToken[owner]");
    await registerPushToken(member.token, "ExponentPushToken[member]");

    const db = drizzle(env.DB);
    await db
      .update(sessions)
      .set({ nextDisclosureAt: Date.now() - 1000 })
      .where(eq(sessions.id, created.session.id));

    const sent: PushMessage[] = [];
    await runScheduledTick(db, Date.now(), collectPush(sent));

    const disclosurePushes = sent.filter((m) => m.body === "位置が開示されました");
    expect(disclosurePushes.map((m) => m.to).toSorted()).toEqual([
      "ExponentPushToken[member]",
      "ExponentPushToken[owner]",
    ]);
    expect(disclosurePushes[0]?.data).toEqual({ sessionId: created.session.id });
  });
});

describe("終了通知", () => {
  it("期限終了で全メンバーへ一度だけ通知する", async () => {
    const owner = await registerUser("主催者");
    const created = await createSession(owner.token);
    await registerPushToken(owner.token, "ExponentPushToken[end]");

    const db = drizzle(env.DB);
    await db
      .update(sessions)
      .set({ expiresAt: Date.now() - 1000 })
      .where(eq(sessions.id, created.session.id));

    const sent: PushMessage[] = [];
    await runScheduledTick(db, Date.now(), collectPush(sent));
    expect(sent.filter((m) => m.body.includes("終了"))).toHaveLength(1);

    // 2回目の tick では再送しない。
    await runScheduledTick(db, Date.now(), collectPush(sent));
    expect(sent.filter((m) => m.body.includes("終了"))).toHaveLength(1);
  });

  it("手動終了は即時に台帳へ記録され Cron と重複しない", async () => {
    const owner = await registerUser("主催者");
    const created = await createSession(owner.token);

    const res = await authedFetch(owner.token, `/sessions/${created.session.id}/end`, {
      method: "POST",
    });
    expect(res.status).toBe(200);

    const db = drizzle(env.DB);
    const sent: PushMessage[] = [];
    await runScheduledTick(db, Date.now(), collectPush(sent));

    const endAlerts = await db
      .select()
      .from(alerts)
      .where(and(eq(alerts.sessionId, created.session.id), eq(alerts.type, "session_end")));
    expect(endAlerts).toHaveLength(1);
    expect(sent.filter((m) => m.body.includes("終了"))).toHaveLength(0);
  });
});

describe("無応答アラート", () => {
  it("interval×3 超過で主催者へ通知しクールダウン中は再発火しない", async () => {
    const owner = await registerUser("主催者");
    const member = await registerUser("参加者");
    const created = await createSession(owner.token);
    const inviteRes = await authedFetch(owner.token, `/sessions/${created.session.id}/invites`, {
      method: "POST",
      body: JSON.stringify({ allowSharing: true, allowViewing: true }),
    });
    const { invite }: InviteResponse = await inviteRes.json();
    const joinRes = await authedFetch(member.token, "/sessions/join", {
      method: "POST",
      body: JSON.stringify({ inviteCode: invite.code }),
    });
    const joined: SessionWithMembershipResponse = await joinRes.json();
    await registerPushToken(owner.token, "ExponentPushToken[owner]");

    // interval 60s × 3 を超えた 200 秒前を最終アップロードにする。
    const db = drizzle(env.DB);
    await db
      .update(memberships)
      .set({ lastUploadedAt: Date.now() - 200_000 })
      .where(eq(memberships.id, joined.membership.id));

    const sent: PushMessage[] = [];
    await runScheduledTick(db, Date.now(), collectPush(sent));

    const noResponse = sent.filter((m) => m.body.includes("届いていません"));
    expect(noResponse).toHaveLength(1);
    expect(noResponse[0]?.to).toBe("ExponentPushToken[owner]");
    expect(noResponse[0]?.body).toContain("参加者");

    // クールダウン内の再 tick では発火しない。
    await runScheduledTick(db, Date.now(), collectPush(sent));
    expect(sent.filter((m) => m.body.includes("届いていません"))).toHaveLength(1);

    const alertRows = await db
      .select()
      .from(alerts)
      .where(and(eq(alerts.membershipId, joined.membership.id), eq(alerts.type, "no_response")));
    expect(alertRows).toHaveLength(1);
  });

  it("一度もアップロードしていないメンバーには発火しない", async () => {
    const owner = await registerUser("主催者");
    const created = await createSession(owner.token);
    await registerPushToken(owner.token, "ExponentPushToken[owner]");

    const sent: PushMessage[] = [];
    await runScheduledTick(drizzle(env.DB), Date.now(), collectPush(sent));
    expect(sent.filter((m) => m.body.includes("届いていません"))).toHaveLength(0);
    expect(created.session.status).toBe("active");
  });
});

describe("履歴の自動削除", () => {
  const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

  it("終了から保持期間を過ぎた位置履歴を削除し、期間内は残す", async () => {
    const owner = await registerUser("主催者");
    const old = await createSession(owner.token);
    const recent = await createSession(owner.token);
    for (const s of [old, recent]) {
      const res = await authedFetch(owner.token, `/sessions/${s.session.id}/locations`, {
        method: "POST",
        body: JSON.stringify({ points: [{ capturedAt: Date.now(), lat: 35, lng: 139 }] }),
      });
      expect(res.status).toBe(200);
    }

    const db = drizzle(env.DB);
    const now = Date.now();
    await db
      .update(sessions)
      .set({ status: "ended", nextDisclosureAt: null, endedAt: now - RETENTION_MS - 1000 })
      .where(eq(sessions.id, old.session.id));
    await db
      .update(sessions)
      .set({ status: "ended", nextDisclosureAt: null, endedAt: now })
      .where(eq(sessions.id, recent.session.id));

    await runScheduledTick(db, now, collectPush([]));

    const oldPoints = await db
      .select()
      .from(locationPoints)
      .where(eq(locationPoints.sessionId, old.session.id));
    const recentPoints = await db
      .select()
      .from(locationPoints)
      .where(eq(locationPoints.sessionId, recent.session.id));
    expect(oldPoints).toHaveLength(0);
    expect(recentPoints).toHaveLength(1);
  });
});
