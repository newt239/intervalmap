import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import type {
  AuthResponse,
  ErrorResponse,
  Session,
  SessionResponse,
  SessionWithMembershipResponse,
} from "@intervalmap/shared";

// 常設招待リンクの統合テスト。リンクは主催者のみが配れ、再生成で旧リンクが無効になる。

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

const joinByCode = async (token: string, inviteCode: string | null) =>
  authedFetch(token, "/sessions/join", {
    method: "POST",
    body: JSON.stringify({ inviteCode }),
  });

const regenerate = async (token: string, session: Session) =>
  authedFetch(token, `/sessions/${session.id}/invite/regenerate`, { method: "POST" });

describe("常設の招待リンク", () => {
  it("作成時に発行され、そのコードで参加できる", async () => {
    const owner = await registerUser("主催者");
    const member = await registerUser("参加者");
    const created = await createSession(owner.token);

    expect(created.session.inviteCode).toHaveLength(10);

    const res = await joinByCode(member.token, created.session.inviteCode);
    expect(res.status).toBe(201);
  });

  it("招待コードは主催者にしか返さない", async () => {
    const owner = await registerUser("主催者");
    const member = await registerUser("参加者");
    const created = await createSession(owner.token);

    const joinRes = await joinByCode(member.token, created.session.inviteCode);
    const joined: SessionWithMembershipResponse = await joinRes.json();
    expect(joined.session.inviteCode).toBeNull();
  });

  it("再生成すると旧コードでは参加できなくなる", async () => {
    const owner = await registerUser("主催者");
    const member = await registerUser("参加者");
    const created = await createSession(owner.token);

    const res = await regenerate(owner.token, created.session);
    expect(res.status).toBe(200);
    const { session }: SessionResponse = await res.json();
    expect(session.inviteCode).toHaveLength(10);
    expect(session.inviteCode).not.toBe(created.session.inviteCode);

    const oldRes = await joinByCode(member.token, created.session.inviteCode);
    expect(oldRes.status).toBe(404);
    const body: ErrorResponse = await oldRes.json();
    expect(body.error.code).toBe("invite_not_found");

    const newRes = await joinByCode(member.token, session.inviteCode);
    expect(newRes.status).toBe(201);
  });

  it("再生成は主催者のみできる", async () => {
    const owner = await registerUser("主催者");
    const member = await registerUser("参加者");
    const created = await createSession(owner.token);
    await joinByCode(member.token, created.session.inviteCode);

    const res = await regenerate(member.token, created.session);
    expect(res.status).toBe(403);
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
