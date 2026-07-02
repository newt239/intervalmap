import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { loadAuth } from "#/features/auth/auth-store";
import { apiFetch } from "#/lib/api-client";
import { sessionListResponseSchema } from "@intervalmap/shared";

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

  const onPullRefresh = () => {
    setRefreshing(true);
    refresh()
      .catch(() => {})
      .finally(() => setRefreshing(false));
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <Text style={styles.screenTitle}>セッション</Text>
      {!registered ? (
        <Text style={styles.empty}>先にホーム画面で表示名を登録してください</Text>
      ) : (
        <FlatList
          data={list?.sessions ?? []}
          keyExtractor={(item) => item.session.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} />}
          ListEmptyComponent={
            list ? <Text style={styles.empty}>参加中のセッションはありません</Text> : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/session/${item.session.id}`)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.session.title}
                </Text>
                <Text
                  style={[
                    styles.statusBadge,
                    item.session.status === "active" ? styles.statusActive : styles.statusInactive,
                  ]}
                >
                  {STATUS_LABELS[item.session.status]}
                </Text>
              </View>
              <Text style={styles.cardMeta}>
                {item.membership.role === "owner" ? "主催" : "参加"}
                {item.session.status === "active" && list
                  ? ` ・ ${formatRemaining(item.session.expiresAt - list.serverNow)}`
                  : ""}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: "#ddd",
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  cardMeta: {
    color: "#555",
    fontSize: 13,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "bold",
  },
  empty: {
    color: "#888",
    padding: 20,
    textAlign: "center",
  },
  listContent: {
    gap: 10,
    padding: 20,
    paddingTop: 8,
  },
  safeArea: {
    flex: 1,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "bold",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  statusActive: {
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
  statusBadge: {
    borderRadius: 8,
    fontSize: 12,
    fontWeight: "bold",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusInactive: {
    backgroundColor: "#f3f4f6",
    color: "#555",
  },
});
