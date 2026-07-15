import { Stack } from "expo-router";

import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "#/lib/query-client";
// バックグラウンド位置タスクをアプリ起動時に必ず登録する。
import "#/lib/location/task";
// 通知ハンドラと push token 再登録をアプリ起動時に必ず仕込む。
import "#/lib/notifications";

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="session/create" options={{ title: "セッションを作成" }} />
        <Stack.Screen name="session/[id]/index" options={{ title: "セッション" }} />
        <Stack.Screen name="session/[id]/invite/index" options={{ title: "メンバーを招待" }} />
        <Stack.Screen name="session/[id]/invite/[inviteId]" options={{ title: "招待" }} />
        <Stack.Screen name="session/[id]/settings" options={{ title: "共有設定" }} />
        <Stack.Screen name="session/[id]/member/[membershipId]" options={{ title: "メンバー" }} />
        <Stack.Screen name="join/index" options={{ title: "招待コードで参加" }} />
        <Stack.Screen name="join/[code]" options={{ title: "セッションに参加" }} />
        <Stack.Screen name="settings/display-name" options={{ title: "表示名" }} />
        <Stack.Screen name="settings/location-permission" options={{ title: "位置情報の権限" }} />
        <Stack.Screen name="settings/notifications" options={{ title: "通知" }} />
      </Stack>
    </QueryClientProvider>
  );
}
