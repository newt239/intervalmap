import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { StyleSheet } from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { MessageView } from "#/components/ui/message-view";
import { ScreenList } from "#/components/ui/screen-list";
import { ScreenTitle } from "#/components/ui/screen-title";
import { useTheme } from "#/components/ui/theme";
import { useAuth, useSessionList } from "#/lib/queries";

import type { ScreenListItem } from "#/components/ui/screen-list/types";

const STATUS_LABELS = { scheduled: "開始前", active: "共有中", ended: "終了" } as const;

const formatRemaining = (ms: number): string => {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `残り ${h}時間${m}分` : `残り ${m}分`;
};

export const SessionList = () => {
  const router = useRouter();
  const theme = useTheme();
  const { data: auth } = useAuth();
  const { data: list, refetch, isRefetching } = useSessionList(auth?.token);

  // タブへ戻ったときに一覧を最新化する。取得中の場合は進行中のリクエストを使う。
  useFocusEffect(
    useCallback(() => {
      if (auth) {
        void refetch({ cancelRefetch: false });
      }
    }, [auth, refetch]),
  );

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
      {auth === null ? (
        <MessageView message="先にホーム画面で表示名を登録してください" />
      ) : (
        <ScreenList
          items={items}
          onPressItem={(id) => router.push(`/session/${id}`)}
          refreshing={isRefetching}
          onRefresh={async () => {
            await refetch();
          }}
          emptyTitle="参加中のセッションはありません"
          emptyDescription="ホーム画面からセッションを作成するか招待コードで参加してください"
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
});
