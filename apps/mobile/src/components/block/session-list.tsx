import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";

import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Fab } from "#/components/ui/fab";
import { ScreenList } from "#/components/ui/screen-list";
import { ScreenTitle } from "#/components/ui/screen-title";
import { useTheme } from "#/components/ui/theme";
import { useAuth, useSessionList } from "#/lib/queries";

import type { ScreenListItem } from "#/components/ui/screen-list/types";

const STATUS_LABELS = { scheduled: "開始前", active: "共有中", ended: "終了" } as const;

export const SessionList = () => {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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
    subtitle: item.membership.role === "owner" ? "主催" : "参加",
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
      <ScreenList
        items={items}
        onPressItem={(id) => {
          router.push(`/session/${id}`);
        }}
        refreshing={isRefetching}
        onRefresh={async () => {
          await refetch();
        }}
        emptyTitle="参加中のセッションはありません"
        emptyDescription="セッションを作成するか、わたしタブから招待コードで参加してください"
      />
      <View style={[styles.fab, { bottom: insets.bottom + 16 }]}>
        <Fab
          title="セッションを作成"
          onPress={() => {
            router.push("/session/create");
          }}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 16,
  },
  safeArea: {
    flex: 1,
  },
});
