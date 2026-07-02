import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import type { AuthResponse, UserResponse } from "@intervalmap/shared";

const registerUser = async (displayName: string): Promise<AuthResponse> => {
  const res = await SELF.fetch("https://example.com/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  });
  expect(res.status).toBe(201);
  return res.json();
};

describe("表示名の更新", () => {
  it("PATCH /users/me で表示名を更新できる", async () => {
    const auth = await registerUser("たろう");

    const res = await SELF.fetch("https://example.com/users/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify({ displayName: "じろう" }),
    });
    expect(res.status).toBe(200);
    const body: UserResponse = await res.json();
    expect(body.user.id).toBe(auth.user.id);
    expect(body.user.displayName).toBe("じろう");
  });

  it("トークンなしの更新を 401 で拒否する", async () => {
    const res = await SELF.fetch("https://example.com/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "じろう" }),
    });
    expect(res.status).toBe(401);
  });

  it("空の表示名を 400 で拒否する", async () => {
    const auth = await registerUser("たろう");
    const res = await SELF.fetch("https://example.com/users/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify({ displayName: "" }),
    });
    expect(res.status).toBe(400);
  });
});
