import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Platform } from "react-native";

import { apiFetch } from "#/lib/api-client";
import { loadAuth } from "#/lib/auth";
import { queryClient } from "#/lib/query-client";
import { registerPushTokenResponseSchema } from "@intervalmap/shared";

// フォアグラウンドでも開示・終了・無応答の通知をバナー表示する。
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

if (Platform.OS === "android") {
  void Notifications.setNotificationChannelAsync("default", {
    name: "セッションの通知",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

const sessionIdOf = (notification: Notifications.Notification): string | null => {
  const sessionId = notification.request.content.data?.sessionId;
  return typeof sessionId === "string" ? sessionId : null;
};

// 開示プッシュの受信を再取得のトリガーにする。開示時刻の権威はあくまでサーバー。
Notifications.addNotificationReceivedListener((notification) => {
  const sessionId = sessionIdOf(notification);
  if (sessionId) {
    void queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
  }
});

// 通知タップで該当セッションへ遷移する。
Notifications.addNotificationResponseReceivedListener((response) => {
  const sessionId = sessionIdOf(response.notification);
  if (sessionId) {
    router.push({ pathname: "/session/[id]", params: { id: sessionId } });
  }
});

// 通知権限を確認し、許可されていれば Expo Push token をサーバーへ登録する。
export const registerPushToken = async (): Promise<Notifications.PermissionResponse> => {
  const permission = await Notifications.requestPermissionsAsync();
  const auth = await loadAuth();
  if (!permission.granted || !auth) {
    return permission;
  }
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
    ?.eas?.projectId;
  const pushToken = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  await apiFetch(registerPushTokenResponseSchema, "/me/push-token", {
    method: "PUT",
    token: auth.token,
    body: JSON.stringify({
      expoPushToken: pushToken.data,
      platform: Platform.OS === "ios" ? "ios" : "android",
    }),
  });
  return permission;
};

// 起動時に権限が既に許可済みならトークンの回転に追随して再登録する。未許可なら何もしない。
void (async () => {
  const permission = await Notifications.getPermissionsAsync();
  if (permission.granted) {
    await registerPushToken();
  }
})().catch(() => {});
