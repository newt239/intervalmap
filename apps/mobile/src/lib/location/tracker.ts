import * as Location from "expo-location";
import { useSyncExternalStore } from "react";
import { Platform } from "react-native";

import { LOCATION_TASK_NAME, saveTrackingContext, stopLocationUpdates } from "./task.ts";

import type { Session } from "@intervalmap/shared";

// 位置取得層の抽象インターフェース。Transistorsoft 版への差し替えを想定する。
// 追跡は必ず expires_at で自動停止し、無期限追跡は実装しない。
export type TrackerStatus = "idle" | "tracking" | "stopped";

export type LocationTracker = {
  start(session: Session, auth: { token: string }): Promise<void>;
  stop(): Promise<void>;
  // アプリ再起動後に OS 側のタスク稼働状態から内部状態を復元する。
  restore(): Promise<TrackerStatus>;
  getStatus(): TrackerStatus;
  subscribe(listener: () => void): () => void;
};

// expo-location + expo-task-manager 実装。選定理由は docs/adr/0001-background-location.md。
// 取得は連続・開示は間欠。取得間隔は短く保ち、送信は OS 側バッチングでまとめる。
const createExpoLocationTracker = (): LocationTracker => {
  let status: TrackerStatus = "idle";
  const listeners = new Set<() => void>();
  const setStatus = (next: TrackerStatus) => {
    status = next;
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    async start(session, auth) {
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
      setStatus("tracking");
    },
    async stop() {
      await stopLocationUpdates();
      setStatus("stopped");
    },
    async restore() {
      const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      setStatus(started ? "tracking" : status === "tracking" ? "stopped" : status);
      return status;
    },
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

// アプリ全体で使う LocationTracker の単一インスタンス。差し替えはここだけ変える。
export const locationTracker: LocationTracker = createExpoLocationTracker();

// 初回購読時に OS 側のタスク稼働状態から表示用ステータスを復元する。
let restoreRequested = false;
const subscribeWithRestore = (listener: () => void): (() => void) => {
  if (!restoreRequested) {
    restoreRequested = true;
    void locationTracker.restore();
  }
  return locationTracker.subscribe(listener);
};

const getTrackerStatus = () => locationTracker.getStatus();

export const useTrackerStatus = (): TrackerStatus =>
  useSyncExternalStore(subscribeWithRestore, getTrackerStatus);
