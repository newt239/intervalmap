import { ExpoLocationTracker } from "./expo-location-tracker.ts";

import type { LocationTracker } from "./location-tracker.ts";

export type { LocationTracker } from "./location-tracker.ts";

// アプリ全体で使う LocationTracker の単一インスタンス。差し替えはここだけ変える。
export const locationTracker: LocationTracker = new ExpoLocationTracker();
