import { describe, expect, it } from "vitest";

import { advanceNextDisclosureAt } from "./tick.ts";

// 開示タイミングはプライバシー不変条件の中核。境界値を必ず押さえる。
describe("advanceNextDisclosureAt", () => {
  const intervalSec = 60;

  it("未到達なら変更しない", () => {
    expect(advanceNextDisclosureAt(1_000_000, intervalSec, 999_999)).toBe(1_000_000);
  });

  it("到達時は1インターバル進める", () => {
    expect(advanceNextDisclosureAt(1_000_000, intervalSec, 1_000_000)).toBe(1_060_000);
    expect(advanceNextDisclosureAt(1_000_000, intervalSec, 1_030_000)).toBe(1_060_000);
  });

  it("Cron 遅延で複数インターバル滞留しても now より後まで一度に進める", () => {
    // 3.5 インターバル遅延 → 4 インターバル進む。開示は1回に集約される前提。
    expect(advanceNextDisclosureAt(1_000_000, intervalSec, 1_210_000)).toBe(1_240_000);
  });

  it("返り値は常に now より後になる", () => {
    for (const now of [1_000_000, 1_059_999, 1_060_000, 1_999_999, 5_432_100]) {
      expect(advanceNextDisclosureAt(1_000_000, intervalSec, now)).toBeGreaterThan(now);
    }
  });
});
