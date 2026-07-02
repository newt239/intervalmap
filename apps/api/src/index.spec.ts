import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// M0 の疎通確認。開示ロジック・期限判定のテストは M2 で必須実装する。
describe("intervalmap-api", () => {
  it("GET / が ok を返す", async () => {
    const res = await SELF.fetch("https://example.com/");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, service: "intervalmap-api" });
  });

  it("GET /health が status ok を返す", async () => {
    const res = await SELF.fetch("https://example.com/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
