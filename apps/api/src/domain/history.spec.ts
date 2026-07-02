import { describe, expect, it } from "vitest";

import { buildDisclosedTrack } from "./history.ts";

import type { LocationPointRow } from "../db/schema.ts";

const point = (id: string, capturedAt: number, uploadedAt: number, lat = 35): LocationPointRow => ({
  id,
  sessionId: "s1",
  membershipId: "m1",
  capturedAt,
  lat,
  lng: 139,
  accuracyM: null,
  battery: null,
  uploadedAt,
});

// 開示前の点を漏らさない不変条件を境界値で固定する。
describe("buildDisclosedTrack", () => {
  it("開示が無ければ何も返さない", () => {
    expect(buildDisclosedTrack([], [point("a", 100, 100)])).toEqual([]);
  });

  it("各開示時点で開示以前の最新点のみ採用し、開示以降の点は返さない", () => {
    const points = [point("a", 100, 110, 35), point("b", 200, 210, 36), point("c", 400, 410, 37)];
    const track = buildDisclosedTrack([300], points);
    expect(track).toHaveLength(1);
    expect(track[0]).toMatchObject({ disclosedAt: 300, capturedAt: 200, lat: 36 });
  });

  it("capturedAt が開示以前でも uploadedAt が開示より後なら採用せず、次の開示から採用する", () => {
    const late = point("a", 100, 350, 35);
    const first = buildDisclosedTrack([300], [late]);
    expect(first).toEqual([]);
    const second = buildDisclosedTrack([300, 600], [late]);
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({ disclosedAt: 600, capturedAt: 100 });
  });

  it("遅延アップロードの古い点は既に採用済みの新しい点を巻き戻さない", () => {
    const fresh = point("a", 200, 210, 36);
    const stale = point("b", 100, 500, 35);
    const track = buildDisclosedTrack([300, 600], [fresh, stale]);
    expect(track).toHaveLength(1);
    expect(track[0]).toMatchObject({ disclosedAt: 300, capturedAt: 200, lat: 36 });
  });

  it("位置が更新されない間は同じ点を繰り返さない", () => {
    const track = buildDisclosedTrack(
      [300, 600, 900],
      [point("a", 100, 110), point("b", 700, 710)],
    );
    expect(track).toHaveLength(2);
    expect(track[0]).toMatchObject({ disclosedAt: 300, capturedAt: 100 });
    expect(track[1]).toMatchObject({ disclosedAt: 900, capturedAt: 700 });
  });

  it("開示ごとに移動の系列を返す", () => {
    const points = [point("a", 100, 110, 35), point("b", 400, 410, 36), point("c", 700, 710, 37)];
    const track = buildDisclosedTrack([300, 600, 900], points);
    expect(track.map((t) => t.lat)).toEqual([35, 36, 37]);
    expect(track.map((t) => t.disclosedAt)).toEqual([300, 600, 900]);
  });
});
