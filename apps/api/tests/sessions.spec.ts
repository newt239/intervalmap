import { env, SELF } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { describe, expect, it } from "vitest";

import { sessions } from "../src/db/schema.ts";
import { runScheduledTick } from "../src/domain/tick.ts";

import type {
  AuthResponse,
  ErrorResponse,
  MapResponse,
  SessionDetailResponse,
  SessionWithMembershipResponse,
  UploadLocationsResponse,
} from "@intervalmap/shared";

// プライバシー不変条件の統合テスト。
// 1. 開示前の位置を返さない（自分自身は常に見える）
// 2. ended 以降のアップロードはサーバー側で拒否する

const registerUser = async (displayName: string): Promise<AuthResponse> => {
  const res = await SELF.fetch("https://example.com/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  });
  expect(res.status).toBe(201);
  return res.json();
};

const authedFetch = (token: string, path: string, init?: RequestInit) =>
  SELF.fetch(`https://example.com${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
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

const joinSession = async (token: string, inviteCode: string) => {
  const res = await authedFetch(token, "/sessions/join", {
    method: "POST",
    body: JSON.stringify({ inviteCode }),
  });
  return res;
};

const uploadPoint = (token: string, sessionId: string, lat: number, lng: number) =>
  authedFetch(token, `/sessions/${sessionId}/locations`, {
    method: "POST",
    body: JSON.stringify({ points: [{ capturedAt: Date.now(), lat, lng }] }),
  });

const fetchMap = async (token: string, sessionId: string): Promise<MapResponse> => {
  const res = await authedFetch(token, `/sessions/${sessionId}/map`);
  expect(res.status).toBe(200);
  return res.json();
};

describe("認証", () => {
  it("トークンなしのアクセスを 401 で拒否する", async () => {
    const res = await SELF.fetch("https://example.com/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "x", intervalSec: 60, durationSec: 3600 }),
    });
    expect(res.status).toBe(401);
  });
});

describe("セッション作成と参加", () => {
  it("作成→参加→詳細取得が通る", async () => {
    const owner = await registerUser("主催者");
    const member = await registerUser("参加者");

    const created = await createSession(owner.token);
    expect(created.session.status).toBe("active");
    expect(created.session.inviteCode).toHaveLength(10);
    // 初回開示は開始から1インターバル後。
    expect(created.session.nextDisclosureAt).toBe(created.session.startsAt + 60 * 1000);
    expect(created.membership.role).toBe("owner");

    const joinRes = await joinSession(member.token, created.session.inviteCode);
    expect(joinRes.status).toBe(201);
    const joined: SessionWithMembershipResponse = await joinRes.json();
    expect(joined.membership.role).toBe("member");

    // 再参加は既存 membership を返す。
    const rejoinRes = await joinSession(member.token, created.session.inviteCode);
    expect(rejoinRes.status).toBe(200);

    const detailRes = await authedFetch(member.token, `/sessions/${created.session.id}`);
    expect(detailRes.status).toBe(200);
    const detail: SessionDetailResponse = await detailRes.json();
    expect(detail.members).toHaveLength(2);
  });

  it("メンバー外の詳細・地図アクセスを 403 で拒否する", async () => {
    const owner = await registerUser("主催者");
    const outsider = await registerUser("部外者");
    const created = await createSession(owner.token);

    const detailRes = await authedFetch(outsider.token, `/sessions/${created.session.id}`);
    expect(detailRes.status).toBe(403);
    const mapRes = await authedFetch(outsider.token, `/sessions/${created.session.id}/map`);
    expect(mapRes.status).toBe(403);
  });
});

describe("開示ビューの不変条件", () => {
  it("開示前は他メンバーの位置を返さず、自分自身の現在位置は見える", async () => {
    const owner = await registerUser("主催者");
    const member = await registerUser("参加者");
    const created = await createSession(owner.token);
    await joinSession(member.token, created.session.inviteCode);

    const uploadRes = await uploadPoint(member.token, created.session.id, 35.68, 139.76);
    expect(uploadRes.status).toBe(200);
    const uploaded: UploadLocationsResponse = await uploadRes.json();
    expect(uploaded.accepted).toBe(1);

    // 参加者本人には自分の現在位置が見える。
    const memberMap = await fetchMap(member.token, created.session.id);
    expect(memberMap.disclosedAt).toBeNull();
    expect(memberMap.locations).toHaveLength(0);
    expect(memberMap.self?.lat).toBe(35.68);

    // 主催者にはまだ誰の位置も見えない。
    const ownerMap = await fetchMap(owner.token, created.session.id);
    expect(ownerMap.locations).toHaveLength(0);
    expect(ownerMap.self).toBeNull();
  });

  it("開示後は開示時点以前の最新位置のみ返し、開示以降の点は返さない", async () => {
    const owner = await registerUser("主催者");
    const member = await registerUser("参加者");
    const created = await createSession(owner.token);
    await joinSession(member.token, created.session.inviteCode);

    await uploadPoint(member.token, created.session.id, 35, 139);

    // 開示時刻を過去に倒して Cron ティックを実行し、開示を発生させる。
    const db = drizzle(env.DB);
    await db
      .update(sessions)
      .set({ nextDisclosureAt: Date.now() - 1000 })
      .where(eq(sessions.id, created.session.id));
    await runScheduledTick(db, Date.now());

    // 開示後にアップロードされた新しい位置。
    await uploadPoint(member.token, created.session.id, 36, 140);

    const ownerMap = await fetchMap(owner.token, created.session.id);
    expect(ownerMap.disclosedAt).not.toBeNull();
    // 開示時点以前の点のみ見える。開示以降の (36.0, 140.0) は絶対に返さない。
    expect(ownerMap.locations).toHaveLength(1);
    expect(ownerMap.locations[0]?.lat).toBe(35);

    // 本人の self は開示に関係なく最新。
    const memberMap = await fetchMap(member.token, created.session.id);
    expect(memberMap.self?.lat).toBe(36);

    // next_disclosure_at は未来へ進んでいる。
    const [row] = await db.select().from(sessions).where(eq(sessions.id, created.session.id));
    expect(row?.nextDisclosureAt).toBeGreaterThan(Date.now() - 60 * 1000);
  });
});

describe("期限と終了の不変条件", () => {
  it("expires_at 到達で ended になり、以降のアップロードを 410 で拒否する", async () => {
    const owner = await registerUser("主催者");
    const created = await createSession(owner.token);

    // 期限を過去に倒す。
    const db = drizzle(env.DB);
    await db
      .update(sessions)
      .set({ expiresAt: Date.now() - 1000 })
      .where(eq(sessions.id, created.session.id));

    // Cron を待たずともアップロード時の遅延反映で拒否される。
    const uploadRes = await uploadPoint(owner.token, created.session.id, 35, 139);
    expect(uploadRes.status).toBe(410);
    const body: ErrorResponse = await uploadRes.json();
    expect(body.error.code).toBe("session_ended");

    const map = await fetchMap(owner.token, created.session.id);
    expect(map.sessionStatus).toBe("ended");
    expect(map.nextDisclosureAt).toBeNull();
  });

  it("Cron ティックでも期限到達セッションを ended にする", async () => {
    const owner = await registerUser("主催者");
    const created = await createSession(owner.token);

    const db = drizzle(env.DB);
    await db
      .update(sessions)
      .set({ expiresAt: Date.now() - 1000 })
      .where(eq(sessions.id, created.session.id));
    await runScheduledTick(db, Date.now());

    const [row] = await db.select().from(sessions).where(eq(sessions.id, created.session.id));
    expect(row?.status).toBe("ended");
    expect(row?.nextDisclosureAt).toBeNull();
  });

  it("主催者の即時終了後はアップロードを拒否し、終了済みへの参加も拒否する", async () => {
    const owner = await registerUser("主催者");
    const member = await registerUser("参加者");
    const created = await createSession(owner.token);
    await joinSession(member.token, created.session.inviteCode);

    const endRes = await authedFetch(owner.token, `/sessions/${created.session.id}/end`, {
      method: "POST",
    });
    expect(endRes.status).toBe(200);

    const uploadRes = await uploadPoint(member.token, created.session.id, 35, 139);
    expect(uploadRes.status).toBe(410);

    const late = await registerUser("遅刻者");
    const joinRes = await joinSession(late.token, created.session.inviteCode);
    expect(joinRes.status).toBe(410);
  });

  it("主催者以外の即時終了を 403 で拒否する", async () => {
    const owner = await registerUser("主催者");
    const member = await registerUser("参加者");
    const created = await createSession(owner.token);
    await joinSession(member.token, created.session.inviteCode);

    const endRes = await authedFetch(member.token, `/sessions/${created.session.id}/end`, {
      method: "POST",
    });
    expect(endRes.status).toBe(403);
  });
});
