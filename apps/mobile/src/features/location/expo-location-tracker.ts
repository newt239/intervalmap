import * as Location from "expo-location";
import { Platform } from "react-native";

import { LOCATION_TASK_NAME, saveTrackingContext, stopLocationUpdates } from "./location-task.ts";

import type { LocationTracker, TrackerAuth, TrackerStatus } from "./location-tracker.ts";

import type { Session } from "@intervalmap/shared";

// expo-location + expo-task-manager 実装。選定理由は docs/adr/0001-background-location.md。
// 取得は連続・開示は間欠。取得間隔は短く保ち、送信は OS 側バッチングでまとめる。
export class ExpoLocationTracker implements LocationTracker {
  #status: TrackerStatus = "idle";

  async start(session: Session, auth: TrackerAuth): Promise<void> {
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (!foreground.granted) {
      throw new Error("位置情報の権限が許可されていません");
    }
    // iOS のみ Always への2段階昇格を試みる。拒否されてもフォアグラウンド追跡は継続できる。
    // Android は ACCESS_BACKGROUND_LOCATION を宣言せずフォアグラウンドサービスのみで運用する。
    if (Platform.OS === "ios") {
      await Location.requestBackgroundPermissionsAsync();
    }

    // タスクがバックグラウンド起動でも参照できるよう先にコンテキストを永続化する。
    await saveTrackingContext({
      sessionId: session.id,
      token: auth.token,
      expiresAt: session.expiresAt,
      intervalSec: session.intervalSec,
    });

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy:
        session.precision === "coarse" ? Location.Accuracy.Balanced : Location.Accuracy.High,
      // 10秒間隔・10m移動で連続取得する。
      timeInterval: 10_000,
      distanceInterval: 10,
      // 開示インターバルに合わせて配信をまとめ電池と通信量を抑える。
      // 上限60秒は無応答アラート判定 interval_sec × 3 を誤発火させないため。
      deferredUpdatesInterval: Math.min(session.intervalSec * 1000, 60_000),
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "位置情報を共有中",
        notificationBody: "セッションの期限が来ると自動的に停止します",
        killServiceOnDestroy: false,
      },
    });
    this.#status = "tracking";
  }

  async stop(): Promise<void> {
    await stopLocationUpdates();
    this.#status = "stopped";
  }

  getStatus(): TrackerStatus {
    return this.#status;
  }

  async restore(): Promise<TrackerStatus> {
    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    this.#status = started ? "tracking" : this.#status === "tracking" ? "stopped" : this.#status;
    return this.#status;
  }
}
