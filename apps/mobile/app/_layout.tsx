import { Stack } from "expo-router";

// バックグラウンド位置タスクをアプリ起動時に必ず登録する。
import "#/features/location/location-task";

// ルートレイアウト。
export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="session/[id]" options={{ title: "セッション" }} />
      <Stack.Screen name="join/[code]" options={{ title: "セッションに参加" }} />
    </Stack>
  );
}
