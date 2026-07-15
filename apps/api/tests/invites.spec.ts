import { env, SELF } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { describe, expect, it } from "vitest";

import { sessions } from "../src/db/schema.ts";
import { runScheduledTick } from "../src/domain/tick.ts";

import type {
  AuthResponse,
  CreateInviteInput,
  ErrorResponse,
  HistoryResponse,
  InviteListResponse,
  InviteResponse,
  MapResponse,
  SessionWithMembershipResponse,
} from "@intervalmap/shared";

// 招待の統合テスト。招待に含めた権限が membership の上限になるプライバシー不変条件を検証する。

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

const createInvite = async (
  token: string,
  sessionId: string,
  input?: CreateInviteInput,
): Promise<InviteResponse> => {
  const res = await authedFetch(token, `/sessions/${sessionId}/invites`, {
    method: "POST",
    body: JSON.stringify(input ?? { allowSharing: true, allowViewing: true }),
  });
  expect(res.status).toBe(201);
  return res.json();
};

const joinSession = async (token: string, inviteCode: string) =>
  authedFetch(token, "/sessions/join", {
    method: "POST",
    body: JSON.stringify({ inviteCode }),
  });

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

describe("招待の発行と上限の不変条件", () => {
  const rawPatchMe = async (
    token: string,
    sessionId: string,
    body: { sharingEnabled?: boolean; viewingEnabled?: boolean },
  ) =>
    authedFetch(token, `/sessions/${sessionId}/me`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });

  it("発行・一覧・失効は主催者のみできる", async () => {
    const owner = await registerUser("主催者");
    const member = await registerUser("参加者");
    const created = await createSession(owner.token);
    const invite = await createInvite(owner.token, created.session.id);
    await joinSession(member.token, invite.invite.code);

    const postRes = await authedFetch(member.token, `/sessions/${created.session.id}/invites`, {
      method: "POST",
      body: JSON.stringify({ allowSharing: true, allowViewing: true }),
    });
    expect(postRes.status).toBe(403);
    const listRes = await authedFetch(member.token, `/sessions/${created.session.id}/invites`);
    expect(listRes.status).toBe(403);
    const deleteRes = await authedFetch(
      member.token,
      `/sessions/${created.session.id}/invites/${invite.invite.id}`,
      { method: "DELETE" },
    );
    expect(deleteRes.status).toBe(403);

    const ownerListRes = await authedFetch(owner.token, `/sessions/${created.session.id}/invites`);
    expect(ownerListRes.status).toBe(200);
    const ownerList: InviteListResponse = await ownerListRes.json();
    expect(ownerList.invites).toHaveLength(1);
  });

  it("両方の権限を含まない招待の発行を拒否する", async () => {
    const owner = await registerUser("主催者");
    const created = await createSession(owner.token);

    const res = await authedFetch(owner.token, `/sessions/${created.session.id}/invites`, {
      method: "POST",
      body: JSON.stringify({ allowSharing: false, allowViewing: false }),
    });
    expect(res.status).toBe(400);
  });

  it("失効した招待では参加できず、参加済みメンバーには影響しない", async () => {
    const owner = await registerUser("主催者");
    const member = await registerUser("参加者");
    const late = await registerUser("遅刻者");
    const created = await createSession(owner.token);
    const invite = await createInvite(owner.token, created.session.id);
    await joinSession(member.token, invite.invite.code);

    const revokeRes = await authedFetch(
      owner.token,
      `/sessions/${created.session.id}/invites/${invite.invite.id}`,
      { method: "DELETE" },
    );
    expect(revokeRes.status).toBe(200);
    const revoked: InviteResponse = await revokeRes.json();
    expect(revoked.invite.revokedAt).not.toBeNull();

    // 失効の再実行は冪等に成功する。
    const againRes = await authedFetch(
      owner.token,
      `/sessions/${created.session.id}/invites/${invite.invite.id}`,
      { method: "DELETE" },
    );
    expect(againRes.status).toBe(200);

    const joinRes = await joinSession(late.token, invite.invite.code);
    expect(joinRes.status).toBe(410);
    const body: ErrorResponse = await joinRes.json();
    expect(body.error.code).toBe("invite_revoked");

    // 失効前に参加したメンバーはそのままアクセスできる。
    const map = await fetchMap(member.token, created.session.id);
    expect(map.sessionStatus).toBe("active");
  });

  it("共有を許可されない招待では有効化もアップロードもできない", async () => {
    const owner = await registerUser("主催者");
    const member = await registerUser("参加者");
    const created = await createSession(owner.token);
    const invite = await createInvite(owner.token, created.session.id, {
      allowSharing: false,
      allowViewing: true,
    });
    await joinSession(member.token, invite.invite.code);

    // 招待で許可されなかった共有は本人でも有効化できない不変条件。
    const patchRes = await rawPatchMe(member.token, created.session.id, { sharingEnabled: true });
    expect(patchRes.status).toBe(403);
    const patchBody: ErrorResponse = await patchRes.json();
    expect(patchBody.error.code).toBe("sharing_not_allowed");

    const uploadRes = await uploadPoint(member.token, created.session.id, 35, 139);
    expect(uploadRes.status).toBe(403);
    const uploadBody: ErrorResponse = await uploadRes.json();
    expect(uploadBody.error.code).toBe("sharing_not_allowed");
  });

  it("閲覧を許可されない招待では開示後も他人の位置と履歴を返さない", async () => {
    const owner = await registerUser("主催者");
    const member = await registerUser("参加者");
    const created = await createSession(owner.token);
    const invite = await createInvite(owner.token, created.session.id, {
      allowSharing: true,
      allowViewing: false,
    });
    await joinSession(member.token, invite.invite.code);

    await uploadPoint(owner.token, created.session.id, 34, 138);
    await uploadPoint(member.token, created.session.id, 35, 139);
    await forceDisclosure(created.session.id);

    // 招待で許可されなかった閲覧は本人でも有効化できない不変条件。
    const patchRes = await rawPatchMe(member.token, created.session.id, { viewingEnabled: true });
    expect(patchRes.status).toBe(403);
    const patchBody: ErrorResponse = await patchRes.json();
    expect(patchBody.error.code).toBe("viewing_not_allowed");

    // 開示後も他人の位置は見えず、自分自身と自分の履歴は見える。
    const map = await fetchMap(member.token, created.session.id);
    expect(map.locations).toHaveLength(0);
    expect(map.self?.lat).toBe(35);

    const history = await fetchHistory(member.token, created.session.id);
    expect(history.tracks).toHaveLength(1);
    expect(history.tracks[0]?.points[0]?.lat).toBe(35);
  });

  it("別の招待での再参加は上限を広げるだけで enabled は変えない", async () => {
    const owner = await registerUser("主催者");
    const member = await registerUser("参加者");
    const created = await createSession(owner.token);
    const viewerInvite = await createInvite(owner.token, created.session.id, {
      allowSharing: false,
      allowViewing: true,
    });
    await joinSession(member.token, viewerInvite.invite.code);

    const fullInvite = await createInvite(owner.token, created.session.id);
    const rejoinRes = await joinSession(member.token, fullInvite.invite.code);
    expect(rejoinRes.status).toBe(200);
    const rejoined: SessionWithMembershipResponse = await rejoinRes.json();
    expect(rejoined.membership.allowedSharing).toBe(true);
    // 上限が広がっても共有が勝手にオンにならない。
    expect(rejoined.membership.sharingEnabled).toBe(false);

    const patchRes = await rawPatchMe(member.token, created.session.id, { sharingEnabled: true });
    expect(patchRes.status).toBe(200);
    const uploadRes = await uploadPoint(member.token, created.session.id, 35, 139);
    expect(uploadRes.status).toBe(200);
  });

  it("終了済みセッションへの発行を 410 で拒否する", async () => {
    const owner = await registerUser("主催者");
    const created = await createSession(owner.token);
    const endRes = await authedFetch(owner.token, `/sessions/${created.session.id}/end`, {
      method: "POST",
    });
    expect(endRes.status).toBe(200);

    const res = await authedFetch(owner.token, `/sessions/${created.session.id}/invites`, {
      method: "POST",
      body: JSON.stringify({ allowSharing: true, allowViewing: true }),
    });
    expect(res.status).toBe(410);
  });
});

describe("招待リンクの中継ページ", () => {
  it("正しい形式のコードには HTML を返し、不正な形式には 404 を返す", async () => {
    const res = await SELF.fetch("https://example.com/join/abcde23456");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("intervalmap://join/abcde23456");

    // 形式外の文字列は HTML に埋め込まず 404。
    const bad = await SELF.fetch("https://example.com/join/%3Cscript%3E12");
    expect(bad.status).toBe(404);
  });

  it("ユニバーサルリンクの検証ファイルを返す", async () => {
    const aasaRes = await SELF.fetch("https://example.com/.well-known/apple-app-site-association");
    expect(aasaRes.status).toBe(200);
    expect(await aasaRes.text()).toContain("dev.newt239.intervalmap");

    const assetRes = await SELF.fetch("https://example.com/.well-known/assetlinks.json");
    expect(assetRes.status).toBe(200);
    expect(await assetRes.text()).toContain("dev.newt239.intervalmap");
  });
});
