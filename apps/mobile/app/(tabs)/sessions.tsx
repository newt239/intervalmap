import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text } from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenList } from "#/components/screen-list";
import { ScreenTitle } from "#/components/screen-title";
import { useTheme } from "#/components/theme";
import { loadAuth } from "#/features/auth/auth-store";
import { apiFetch } from "#/lib/api-client";
import { sessionListResponseSchema } from "@intervalmap/shared";

import type { ScreenListItem } from "#/components/screen-list/types";
import type { SessionListResponse } from "@intervalmap/shared";

const STATUS_LABELS = { scheduled: "開始前", active: "共有中", ended: "終了" } as const;

const formatRemaining = (ms: number): string => {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `残り ${h}時間${m}分` : `残り ${m}分`;
};

// 参加中のセッション一覧。
export default function SessionsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [list, setList] = useState<SessionListResponse | null>(null);
  const [registered, setRegistered] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    const auth = await loadAuth();
    if (!auth) {
      setRegistered(false);
      return;
    }
    setRegistered(true);
    const res = await apiFetch(sessionListResponseSchema, "/sessions", { token: auth.token });
    setList(res);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, [refresh]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } catch {
      // 引っ張って更新の失敗は無視して前回の一覧を残す。
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const items: ScreenListItem[] = (list?.sessions ?? []).map((item) => ({
    id: item.session.id,
    title: item.session.title,
    subtitle:
      (item.membership.role === "owner" ? "主催" : "参加") +
      (item.session.status === "active" && list
        ? ` ・ ${formatRemaining(item.session.expiresAt - list.serverNow)}`
        : ""),
    status: {
      label: STATUS_LABELS[item.session.status],
      tone: item.session.status === "active" ? "active" : "muted",
    },
  }));

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.groupedBackground }]}
      edges={["top"]}
    >
      <ScreenTitle title="セッション" />
      {registered ? (
        <ScreenList
          items={items}
          onPressItem={(id) => router.push(`/session/${id}`)}
          refreshing={refreshing}
          onRefresh={onRefresh}
          emptyTitle="参加中のセッションはありません"
          emptyDescription="ホーム画面からセッションを作成するか招待コードで参加してください"
        />
      ) : (
        <Text style={[styles.empty, { color: theme.secondaryLabel }]}>
          先にホーム画面で表示名を登録してください
        </Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  empty: {
    padding: 20,
    textAlign: "center",
  },
  safeArea: {
    flex: 1,
  },
});
