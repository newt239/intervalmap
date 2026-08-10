import { Stack } from "expo-router";

import { QueryClientProvider } from "@tanstack/react-query";

import { LoadingView } from "#/components/ui/loading-view";
import { useAuth } from "#/lib/queries";
import { queryClient } from "#/lib/query-client";
// バックグラウンド位置タスクをアプリ起動時に必ず登録する。
import "#/lib/location/task";
// 通知ハンドラと push token 再登録をアプリ起動時に必ず仕込む。
import "#/lib/notifications";

// 表示名未登録なら保護スクリーンが除外され onboarding/index が initial route になる。
const RootNavigator = () => {
  const { data: auth, isLoading } = useAuth();
  if (isLoading) {
    return <LoadingView />;
  }
  return (
    <Stack>
      <Stack.Protected guard={auth != null}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="session/create" options={{ title: "セッションを作成" }} />
        <Stack.Screen name="session/[id]/index" options={{ title: "セッション" }} />
        <Stack.Screen name="session/[id]/invite/index" options={{ title: "メンバーを招待" }} />
        <Stack.Screen name="session/[id]/settings" options={{ title: "セッションの設定" }} />
        <Stack.Screen name="session/[id]/member/[membershipId]" options={{ title: "メンバー" }} />
        <Stack.Screen name="settings/display-name" options={{ title: "表示名" }} />
        <Stack.Screen name="settings/location-permission" options={{ title: "位置情報の権限" }} />
        <Stack.Screen name="settings/notifications" options={{ title: "通知" }} />
      </Stack.Protected>
      <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding/display-name" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding/location" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding/notifications" options={{ headerShown: false }} />
      {/* join は未登録でも招待リンクから参加できるよう保護しない。 */}
      <Stack.Screen name="join/index" options={{ title: "招待コードで参加" }} />
      <Stack.Screen name="join/[code]" options={{ title: "セッションに参加" }} />
    </Stack>
  );
};

// useAuth は QueryClientProvider の内側でしか呼べないためナビゲータと分ける。
const RootLayout = () => (
  <QueryClientProvider client={queryClient}>
    <RootNavigator />
  </QueryClientProvider>
);

export default RootLayout;
