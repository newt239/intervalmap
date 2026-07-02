import type { LocationTracker, TrackerStatus } from "./location-tracker.ts";

import type { Session } from "@intervalmap/shared";

// expo-location + expo-task-manager 実装。M0 はスタブで M1 に本実装する。
export class ExpoLocationTracker implements LocationTracker {
  #status: TrackerStatus = "idle";

  async start(_session: Session): Promise<void> {
    // TODO M1: expo-location のバックグラウンド追跡を開始する。
    this.#status = "tracking";
  }

  async stop(): Promise<void> {
    // TODO M1: タスク解除とフォアグラウンドサービス停止。
    this.#status = "stopped";
  }

  getStatus(): TrackerStatus {
    return this.#status;
  }
}
