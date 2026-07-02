import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { LoadingView } from "#/components/loading-view";
import { useTheme } from "#/components/theme";
import { loadAuth } from "#/features/auth/auth-store";
import { SessionMap } from "#/features/map/session-map";
import { apiFetch } from "#/lib/api-client";
import {
  historyResponseSchema,
  mapResponseSchema,
  sessionDetailResponseSchema,
} from "@intervalmap/shared";

import type { StoredAuth } from "#/features/auth/auth-store";
import type { HistoryResponse, MapResponse, SessionDetailResponse } from "@intervalmap/shared";

const formatDateTime = (ms: number): string =>
  new Date(ms).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// メンバー詳細画面。開示済みの最新位置と移動履歴のみ表示する。自分自身は現在位置も見える。
export default function MemberScreen() {
  const { id, membershipId } = useLocalSearchParams<{ id: string; membershipId: string }>();
  const theme = useTheme();
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [detail, setDetail] = useState<SessionDetailResponse | null>(null);
  const [mapData, setMapData] = useState<MapResponse | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);

  useEffect(() => {
    loadAuth().then(setAuth);
  }, []);

  const refresh = useCallback(async () => {
    if (!auth || !id) {
      return;
    }
    const [detailRes, mapRes, historyRes] = await Promise.all([
      apiFetch(sessionDetailResponseSchema, `/sessions/${id}`, { token: auth.token }),
      apiFetch(mapResponseSchema, `/sessions/${id}/map`, { token: auth.token }),
      apiFetch(historyResponseSchema, `/sessions/${id}/history`, { token: auth.token }),
    ]);
    setDetail(detailRes);
    setMapData(mapRes);
    setHistory(historyRes);
  }, [auth, id]);

  useEffect(() => {
    refresh().catch((error) => {
      Alert.alert("読み込みに失敗しました", error instanceof Error ? error.message : String(error));
    });
  }, [refresh]);

  // 開示予定に合わせて1回だけ再取得する。
  useEffect(() => {
    if (!mapData || mapData.sessionStatus === "ended") {
      return;
    }
    const delay =
      mapData.nextDisclosureAt !== null
        ? Math.max(2000, mapData.nextDisclosureAt - mapData.serverNow + 2000)
        : 30_000;
    const timer = setTimeout(() => {
      refresh().catch(() => {});
    }, delay);
    return () => clearTimeout(timer);
  }, [mapData, refresh]);

  if (!detail || !mapData || !history) {
    return <LoadingView />;
  }

  const member = detail.members.find((m) => m.id === membershipId) ?? null;
  if (!member) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.meta, { color: theme.secondaryLabel }]}>メンバーが見つかりません</Text>
      </View>
    );
  }

  const isSelf = member.userId === auth?.userId;
  const location = isSelf
    ? mapData.self
    : (mapData.locations.find((l) => l.membershipId === member.id) ?? null);
  const track = history.tracks.find((t) => t.membershipId === member.id) ?? null;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: member.displayName }} />
      <View style={styles.header}>
        <Text style={[styles.meta, { color: theme.secondaryLabel }]}>
          {`${member.role === "owner" ? "主催" : "参加" 
            } ・ ${ 
            member.sharingEnabled ? "位置共有オン" : "位置共有オフ" 
            } ・ ` +
            `参加 ${formatDateTime(member.joinedAt)}`}
        </Text>
        <Text style={[styles.meta, { color: theme.secondaryLabel }]}>
          {location
            ? (isSelf ? "現在位置 " : "最終開示位置 ") + formatDateTime(location.capturedAt)
            : "開示済みの位置はまだありません"}
        </Text>
      </View>

      <SessionMap
        locations={isSelf || !location ? [] : [location]}
        self={isSelf ? location : null}
        selfMembershipId={isSelf ? member.id : null}
        tracks={track ? [track] : []}
      />

      {track ? null : (
        <Text style={[styles.historyEmpty, { color: theme.secondaryLabel }]}>
          開示済みの移動履歴はまだありません
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  historyEmpty: {
    fontSize: 12,
    padding: 12,
    textAlign: "center",
  },
  meta: {
    fontSize: 13,
  },
});
