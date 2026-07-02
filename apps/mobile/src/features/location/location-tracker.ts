import type { Session } from "@intervalmap/shared";

// 位置取得層の抽象インターフェース。Transistorsoft 版への差し替えを想定する。
// 追跡は必ず expires_at で自動停止し、無期限追跡は実装しない。
export type TrackerStatus = "idle" | "tracking" | "stopped";

export type LocationTracker = {
  start(session: Session): Promise<void>;
  stop(): Promise<void>;
  getStatus(): TrackerStatus;
};
