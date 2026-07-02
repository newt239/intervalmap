import type { LocationPointRow } from "../db/schema.ts";

export type DisclosedTrackPoint = {
  disclosedAt: number;
  capturedAt: number;
  lat: number;
  lng: number;
  accuracyM: number | null;
};

// 各開示時点で captured/uploaded とも開示以前の最新点のみ採用する。開示前の位置を返さない不変条件の中核。
export const buildDisclosedTrack = (
  disclosedAts: number[],
  points: LocationPointRow[],
): DisclosedTrackPoint[] => {
  const ascDisclosures = [...disclosedAts].toSorted((a, b) => a - b);
  const ascPoints = [...points].toSorted((a, b) => a.capturedAt - b.capturedAt);

  const track: DisclosedTrackPoint[] = [];
  let index = 0;
  // 開示に間に合わなかった点は次の開示まで保留する。
  let pending: LocationPointRow[] = [];
  let best: LocationPointRow | null = null;
  let lastPointId: string | null = null;

  for (const disclosedAt of ascDisclosures) {
    for (;;) {
      const point = ascPoints[index];
      if (!point || point.capturedAt > disclosedAt) {
        break;
      }
      pending.push(point);
      index++;
    }
    const still: LocationPointRow[] = [];
    for (const point of pending) {
      if (point.uploadedAt > disclosedAt) {
        still.push(point);
      } else if (best === null || point.capturedAt >= best.capturedAt) {
        best = point;
      }
    }
    pending = still;
    if (best !== null && best.id !== lastPointId) {
      track.push({
        disclosedAt,
        capturedAt: best.capturedAt,
        lat: best.lat,
        lng: best.lng,
        accuracyM: best.accuracyM,
      });
      lastPointId = best.id;
    }
  }
  return track;
};
