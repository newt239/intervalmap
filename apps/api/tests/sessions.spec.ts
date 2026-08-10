import { env, SELF } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { describe, expect, it } from "vitest";

import {
  MAX_SESSION_DURATION_SEC,
  type AuthResponse,
  type ErrorResponse,
  type HistoryResponse,
  type MapResponse,
  type MembershipResponse,
  type Session,
  type SessionDetailResponse,
  type SessionListResponse,
  type SessionWithMembershipResponse,
  type UploadLocationsResponse,
} from "@intervalmap/shared";

import { sessions } from "../src/db/schema.ts";
import { runScheduledTick } from "../src/domain/tick.ts";

// プライバシー不変条件の統合テスト。
// 1. 開示前の位置を返さない（自分自身は常に見える）
// 2. ended 以降のアップロードはサーバー側で拒否する
// 3. 退出したメンバーは地図・履歴・アップロードの対象から外れる

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
    body: JSON.stringify({ title: "テスト", intervalSec: 60 }),
  });
  expect(res.status).toBe(201);
  return res.json();
};

const joinSession = async (token: string, session: Session) =>
  authedFetch(token, "/sessions/join", {
    method: "POST",
    body: JSON.stringify({ inviteCode: session.inviteCode }),
  });

const leaveSession = async (token: string, sessionId: string) =>
  authedFetch(token, `/sessions/${sessionId}/me`, { method: "DELETE" });

const uploadPoint = async (token: string, sessionId: string, lat: number, lng: number) =>
  authedFetch(token, `/sessions/${sessionId}/locations`, {
    method: "POST",
    body: JSON.stringify({ points: [{ capturedAt: Date.now(), lat, lng }] }),
  });

const fetchMap = async (token: string, sessionId: string): Promise<MapResponse> => {
  const res = await authedFetch(token, `/sessions/${sessionId}/map`);
  expect(res.status).toBe(200);
  return res.json();
};

const fetchHistory = async (token: string, sessionId: string): Promise<HistoryResponse> => {
  const res = await authedFetch(token, `/sessions/${sessionId}/history`);
  expect(res.status).toBe(200);
  return res.json();
};

// 開示時刻を過去に倒して開示を1回発生させる。
const forceDisclosure = async (sessionId: string) => {
  const db = drizzle(env.DB);
  await db
    .update(sessions)
    .set({ nextDisclosureAt: Date.now() - 1000 })
    .where(eq(sessions.id, sessionId));
  await runScheduledTick(db, Date.now());
};

describe("認証", () => {
  it("トークンなしのアクセスを 401 で拒否する", async () => {
    const res = await SELF.fetch("https://example.com/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "x", intervalSec: 60 }),
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
    // 初回開示は開始から1インターバル後。
    expect(created.session.nextDisclosureAt).toBe(created.session.startsAt + 60 * 1000);
    expect(created.membership.role).toBe("owner");

    const joinRes = await joinSession(member.token, created.session);
    expect(joinRes.status).toBe(201);
    const joined: SessionWithMembershipResponse = await joinRes.json();
    expect(joined.membership.role).toBe("member");
    expect(joined.membership.leftAt).toBeNull();

    // 再参加は既存 membership を返す。
    const rejoinRes = await joinSession(member.token, created.session);
    expect(rejoinRes.status).toBe(200);

    const detailRes = await authedFetch(member.token, `/sessions/${created.session.id}`);
    expect(detailRes.status).toBe(200);
    const detail: SessionDetailResponse = await detailRes.json();
    expect(detail.members).toHaveLength(2);
  });

  it("期限はユーザーが指定せず安全網としてサーバーが付与する", async () => {
    const owner = await registerUser("主催者");
    const created = await createSession(owner.token);

    // 無期限追跡を作らない不変条件。終了は手動だが期限は必ず入る。
    expect(created.session.expiresAt).toBe(
      created.session.startsAt + MAX_SESSION_DURATION_SEC * 1000,
    );
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
    await joinSession(member.token, created.session);

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
    await joinSession(member.token, created.session);

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
    await joinSession(member.token, created.session);

    const endRes = await authedFetch(owner.token, `/sessions/${created.session.id}/end`, {
      method: "POST",
    });
    expect(endRes.status).toBe(200);

    const uploadRes = await uploadPoint(member.token, created.session.id, 35, 139);
    expect(uploadRes.status).toBe(410);

    const late = await registerUser("遅刻者");
    const joinRes = await joinSession(late.token, created.session);
    expect(joinRes.status).toBe(410);
  });

  it("主催者以外の即時終了を 403 で拒否する", async () => {
    const owner = await registerUser("主催者");
    const member = await registerUser("参加者");
    const created = await createSession(owner.token);
    await joinSession(member.token, created.session);

    const endRes = await authedFetch(member.token, `/sessions/${created.session.id}/end`, {
      method: "POST",
    });
    expect(endRes.status).toBe(403);
  });
});

describe("退出", () => {
  it("退出後はアップロードを拒否し、他メンバーの地図・履歴から消える", async () => {
    const owner = await registerUser("主催者");
    const member = await registerUser("参加者");
    const created = await createSession(owner.token);
    await joinSession(member.token, created.session);

    await uploadPoint(member.token, created.session.id, 35, 139);
    await forceDisclosure(created.session.id);

    const before = await fetchMap(owner.token, created.session.id);
    expect(before.locations).toHaveLength(1);

    const leaveRes = await leaveSession(member.token, created.session.id);
    expect(leaveRes.status).toBe(200);
    const left: MembershipResponse = await leaveRes.json();
    expect(left.membership.leftAt).not.toBeNull();

    const map = await fetchMap(owner.token, created.session.id);
    expect(map.locations).toHaveLength(0);
    const history = await fetchHistory(owner.token, created.session.id);
    expect(history.tracks).toHaveLength(0);

    const detailRes = await authedFetch(owner.token, `/sessions/${created.session.id}`);
    const detail: SessionDetailResponse = await detailRes.json();
    expect(detail.members).toHaveLength(1);

    // 退出者はメンバー外として扱われる。
    const uploadRes = await uploadPoint(member.token, created.session.id, 36, 140);
    expect(uploadRes.status).toBe(403);
    const mapRes = await authedFetch(member.token, `/sessions/${created.session.id}/map`);
    expect(mapRes.status).toBe(403);
  });

  it("退出したセッションは一覧に出ず、再参加すると membership が復活する", async () => {
    const owner = await registerUser("主催者");
    const member = await registerUser("参加者");
    const created = await createSession(owner.token);
    const joinRes = await joinSession(member.token, created.session);
    const joined: SessionWithMembershipResponse = await joinRes.json();

    await leaveSession(member.token, created.session.id);

    const listRes = await authedFetch(member.token, "/sessions");
    const list: SessionListResponse = await listRes.json();
    expect(list.sessions).toHaveLength(0);

    const rejoinRes = await joinSession(member.token, created.session);
    expect(rejoinRes.status).toBe(200);
    const rejoined: SessionWithMembershipResponse = await rejoinRes.json();
    // 同じ membership が復活するので、退出前の履歴もそのまま引き継がれる。
    expect(rejoined.membership.id).toBe(joined.membership.id);
    expect(rejoined.membership.leftAt).toBeNull();
  });

  it("退出済みへの再実行と主催者の退出を 403 で拒否する", async () => {
    const owner = await registerUser("主催者");
    const member = await registerUser("参加者");
    const created = await createSession(owner.token);
    await joinSession(member.token, created.session);

    const firstRes = await leaveSession(member.token, created.session.id);
    expect(firstRes.status).toBe(200);
    const secondRes = await leaveSession(member.token, created.session.id);
    expect(secondRes.status).toBe(403);

    const ownerRes = await leaveSession(owner.token, created.session.id);
    expect(ownerRes.status).toBe(403);
    const body: ErrorResponse = await ownerRes.json();
    expect(body.error.code).toBe("owner_cannot_leave");
  });
});

describe("参加中セッション一覧", () => {
  it("参加中のセッションのみ自分の membership 付きで返す", async () => {
    const owner = await registerUser("主催者");
    const member = await registerUser("参加者");
    const created = await createSession(owner.token);
    await joinSession(member.token, created.session);
    // member が参加していないセッションは一覧に出ない。
    await createSession(owner.token);

    const res = await authedFetch(member.token, "/sessions");
    expect(res.status).toBe(200);
    const list: SessionListResponse = await res.json();
    expect(list.sessions).toHaveLength(1);
    expect(list.sessions[0]?.session.id).toBe(created.session.id);
    expect(list.sessions[0]?.membership.role).toBe("member");
    expect(list.sessions[0]?.membership.displayName).toBe("参加者");

    const ownerRes = await authedFetch(owner.token, "/sessions");
    const ownerList: SessionListResponse = await ownerRes.json();
    expect(ownerList.sessions).toHaveLength(2);
    expect(ownerList.sessions.every((s) => s.membership.role === "owner")).toBe(true);
  });

  it("期限切れセッションを一覧でも ended として返す", async () => {
    const owner = await registerUser("主催者");
    const created = await createSession(owner.token);

    const db = drizzle(env.DB);
    await db
      .update(sessions)
      .set({ expiresAt: Date.now() - 1000 })
      .where(eq(sessions.id, created.session.id));

    const res = await authedFetch(owner.token, "/sessions");
    const list: SessionListResponse = await res.json();
    expect(list.sessions[0]?.session.status).toBe("ended");
    expect(list.sessions[0]?.session.nextDisclosureAt).toBeNull();
  });
});

describe("移動履歴の不変条件", () => {
  it("開示前は履歴を返さず、開示後は開示時点以前の点のみ返す", async () => {
    const owner = await registerUser("主催者");
    const member = await registerUser("参加者");
    const created = await createSession(owner.token);
    await joinSession(member.token, created.session);

    await uploadPoint(member.token, created.session.id, 35, 139);

    const before = await fetchHistory(owner.token, created.session.id);
    expect(before.tracks).toHaveLength(0);

    await forceDisclosure(created.session.id);

    // 開示後の点は次の開示まで履歴に現れない。
    await uploadPoint(member.token, created.session.id, 36, 140);

    const after = await fetchHistory(owner.token, created.session.id);
    expect(after.tracks).toHaveLength(1);
    expect(after.tracks[0]?.points).toHaveLength(1);
    expect(after.tracks[0]?.points[0]?.lat).toBe(35);

    // 本人にも開示以降の点は返さない。
    const own = await fetchHistory(member.token, created.session.id);
    expect(own.tracks[0]?.points).toHaveLength(1);
    expect(own.tracks[0]?.points[0]?.lat).toBe(35);

    await forceDisclosure(created.session.id);
    const replay = await fetchHistory(owner.token, created.session.id);
    expect(replay.tracks[0]?.points.map((p) => p.lat)).toEqual([35, 36]);
  });

  it("メンバー外の履歴アクセスを 403 で拒否する", async () => {
    const owner = await registerUser("主催者");
    const outsider = await registerUser("部外者");
    const created = await createSession(owner.token);

    const res = await authedFetch(outsider.token, `/sessions/${created.session.id}/history`);
    expect(res.status).toBe(403);
  });
});
