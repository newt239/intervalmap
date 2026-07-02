import type { Session } from "@intervalmap/shared";

// 位置取得層の抽象インターフェース。Transistorsoft 版への差し替えを想定する。
// 追跡は必ず expires_at で自動停止し、無期限追跡は実装しない。
export type TrackerStatus = "idle" | "tracking" | "stopped";

export type TrackerAuth = {
  token: string;
};

export type LocationTracker = {
  start(session: Session, auth: TrackerAuth): Promise<void>;
  stop(): Promise<void>;
  getStatus(): TrackerStatus;
  // アプリ再起動後に OS 側のタスク稼働状態から内部状態を復元する。
  restore(): Promise<TrackerStatus>;
};
