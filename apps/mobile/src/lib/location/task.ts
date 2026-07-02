import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";

import { ApiError, apiFetch } from "#/lib/api-client";
import { MAX_LOCATION_BATCH_SIZE, uploadLocationsResponseSchema } from "@intervalmap/shared";

import type { LocationPointInput } from "@intervalmap/shared";

export const LOCATION_TASK_NAME = "intervalmap-location-upload";

// バックグラウンド再起動後もタスクが追跡対象を特定できるようにする永続コンテキスト。
const TRACKING_CONTEXT_KEY = "intervalmap-tracking-context";

export type TrackingContext = {
  sessionId: string;
  token: string;
  expiresAt: number;
  intervalSec: number;
};

export const saveTrackingContext = async (ctx: TrackingContext): Promise<void> => {
  // 端末ロック中のバックグラウンドタスクからも読めるよう AFTER_FIRST_UNLOCK にする。
  await SecureStore.setItemAsync(TRACKING_CONTEXT_KEY, JSON.stringify(ctx), {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });
};

// タスク解除とコンテキスト破棄。停止経路はすべてここを通す。
export const stopLocationUpdates = async (): Promise<void> => {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
  await SecureStore.deleteItemAsync(TRACKING_CONTEXT_KEY);
};

// 送信待ちキュー。失敗分は保持して次回に再送し、上限超過分は古い順に破棄する。
const MAX_PENDING_POINTS = 500;
const pendingPoints: LocationPointInput[] = [];

type LocationTaskData = { locations?: Location.LocationObject[] };

// 位置取得タスク本体。モジュールのトップレベルで登録される必要がある。
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("位置取得タスクでエラー", error);
    return;
  }
  const raw = await SecureStore.getItemAsync(TRACKING_CONTEXT_KEY);
  const ctx = raw ? (JSON.parse(raw) as TrackingContext) : null;
  if (!ctx) {
    await stopLocationUpdates();
    return;
  }
  // 追跡は必ず有限。期限到達でクライアント側でも自走停止し、サーバー側の拒否と二重化する。
  if (Date.now() >= ctx.expiresAt) {
    await stopLocationUpdates();
    return;
  }

  for (const loc of (data as LocationTaskData | undefined)?.locations ?? []) {
    pendingPoints.push({
      capturedAt: loc.timestamp,
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      accuracyM: loc.coords.accuracy ?? null,
      battery: null,
    });
  }
  if (pendingPoints.length > MAX_PENDING_POINTS) {
    pendingPoints.splice(0, pendingPoints.length - MAX_PENDING_POINTS);
  }
  if (pendingPoints.length === 0) {
    return;
  }

  const batch = pendingPoints.slice(0, MAX_LOCATION_BATCH_SIZE);
  try {
    await apiFetch(uploadLocationsResponseSchema, `/sessions/${ctx.sessionId}/locations`, {
      method: "POST",
      token: ctx.token,
      body: JSON.stringify({ points: batch }),
    });
    pendingPoints.splice(0, batch.length);
  } catch (error) {
    // サーバーがセッション終了を通知したら即時停止する。
    if (error instanceof ApiError && error.code === "session_ended") {
      await stopLocationUpdates();
      return;
    }
    // 通信失敗はキューに残し次回コールバックで再送する。
    console.warn("位置アップロードに失敗", error);
  }
});
