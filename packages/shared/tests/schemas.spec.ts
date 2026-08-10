import { describe, expect, it } from "vitest";

import { MIN_INTERVAL_SEC } from "../src/constants.ts";
import { createSessionInputSchema, uploadLocationsInputSchema } from "../src/schemas/index.ts";

// スキーマ配線の疎通確認。開示ロジックのテストは apps/api 側にある。
describe("createSessionInputSchema", () => {
  const base = {
    title: "ハイキング",
    intervalSec: 300,
    precision: "exact" as const,
  };

  it("正常な入力を受理する", () => {
    const parsed = createSessionInputSchema.parse(base);
    expect(parsed.intervalSec).toBe(300);
    expect(parsed.precision).toBe("exact");
  });

  it("インターバル下限未満を拒否する", () => {
    const result = createSessionInputSchema.safeParse({
      ...base,
      intervalSec: MIN_INTERVAL_SEC - 1,
    });
    expect(result.success).toBe(false);
  });
});

describe("uploadLocationsInputSchema", () => {
  it("空バッチを拒否する", () => {
    const result = uploadLocationsInputSchema.safeParse({ points: [] });
    expect(result.success).toBe(false);
  });

  it("欠損 accuracy/battery を null で補完する", () => {
    const parsed = uploadLocationsInputSchema.parse({
      points: [{ capturedAt: 123, lat: 35.6, lng: 139.7 }],
    });
    expect(parsed.points[0]?.accuracyM).toBeNull();
    expect(parsed.points[0]?.battery).toBeNull();
  });
});
