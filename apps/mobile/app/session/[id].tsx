import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, Share, StyleSheet, Switch, Text, View } from "react-native";

import { ActionButton } from "#/components/action-button";
import { LoadingView } from "#/components/loading-view";
import { useTheme } from "#/components/theme";
import { loadAuth } from "#/features/auth/auth-store";
import { locationTracker } from "#/features/location";
import { SessionMap } from "#/features/map/session-map";
import { apiFetch } from "#/lib/api-client";
import {
  historyResponseSchema,
  mapResponseSchema,
  sessionDetailResponseSchema,
} from "@intervalmap/shared";

import type { StoredAuth } from "#/features/auth/auth-store";
import type { HistoryResponse, MapResponse, SessionDetailResponse } from "@intervalmap/shared";

// 残り時間の表示フォーマット。負値は 0 に丸める。
const formatCountdown = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
};

// セッション地図画面。表示は最新開示時点のメンバー位置と自分の現在位置のみ。
export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [detail, setDetail] = useState<SessionDetailResponse | null>(null);
  const [mapData, setMapData] = useState<MapResponse | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  // serverNow と端末時計の差。カウントダウンを端末時計に依存させないための補正値。
  const clockOffsetRef = useRef(0);

  useEffect(() => {
    loadAuth().then((stored) => {
      if (!stored) {
        Alert.alert("エラー", "先にホーム画面で表示名を登録してください");
        router.replace("/");
        return;
      }
      setAuth(stored);
    });
  }, [router]);

  useEffect(() => {
    locationTracker.restore().then((status) => setTracking(status === "tracking"));
  }, []);

  const refresh = useCallback(async () => {
    if (!auth || !id) {
      return;
    }
    const [detailRes, mapRes] = await Promise.all([
      apiFetch(sessionDetailResponseSchema, `/sessions/${id}`, { token: auth.token }),
      apiFetch(mapResponseSchema, `/sessions/${id}/map`, { token: auth.token }),
    ]);
    clockOffsetRef.current = mapRes.serverNow - Date.now();
    setDetail(detailRes);
    setMapData(mapRes);
  }, [auth, id]);

  useEffect(() => {
    refresh().catch((error) => {
      Alert.alert("読み込みに失敗しました", error instanceof Error ? error.message : String(error));
    });
  }, [refresh]);

  // next_disclosure_at に合わせて1回だけ再取得する。無駄なポーリングを避ける。
  useEffect(() => {
    if (!mapData || mapData.sessionStatus === "ended") {
      return;
    }
    const serverNow = Date.now() + clockOffsetRef.current;
    // 開示予定があればその2秒後に1回だけ、無ければ30秒間隔で再取得する。
    const delay =
      mapData.nextDisclosureAt !== null
        ? Math.max(2000, mapData.nextDisclosureAt - serverNow + 2000)
        : 30_000;
    const timer = setTimeout(() => {
      refresh().catch(() => {});
    }, delay);
    return () => clearTimeout(timer);
  }, [mapData, refresh]);

  // 履歴表示中は開示の更新に合わせて取り直す。
  const disclosedAt = mapData?.disclosedAt ?? null;
  useEffect(() => {
    if (!showHistory || !auth || !id || disclosedAt === null) {
      return;
    }
    apiFetch(historyResponseSchema, `/sessions/${id}/history`, { token: auth.token })
      .then(setHistory)
      .catch(() => {});
  }, [showHistory, auth, id, disclosedAt]);

  // カウントダウン表示用の1秒ティック。
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // セッションが終了したら追跡も止める。期限による自動停止と二重化。
  useEffect(() => {
    if (mapData?.sessionStatus === "ended" && tracking) {
      locationTracker.stop().then(() => setTracking(false));
    }
  }, [mapData, tracking]);

  const startSharing = () => {
    if (!detail || !auth) {
      return;
    }
    // 権限昇格の前に理由説明を必ず挟む。審査・UX 上の必須要件。
    Alert.alert(
      "位置情報の共有を開始",
      "セッションに参加している間、位置情報がバックグラウンドで記録され、設定されたインターバルごとにのみメンバーへ公開されます。期限が来ると追跡は自動的に停止します。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "続ける",
          onPress: () => {
            locationTracker
              .start(detail.session, { token: auth.token })
              .then(() => setTracking(true))
              .catch((error: unknown) => {
                Alert.alert(
                  "開始できませんでした",
                  error instanceof Error ? error.message : String(error),
                );
              });
          },
        },
      ],
    );
  };

  const stopSharing = () => {
    locationTracker.stop().then(() => setTracking(false));
  };

  const shareInvite = () => {
    if (!detail) {
      return;
    }
    Share.share({
      message: `「${detail.session.title}」に参加してください。招待コード: ${detail.session.inviteCode}`,
    }).catch(() => {});
  };

  if (!detail || !mapData) {
    return <LoadingView />;
  }

  const serverNow = nowTick + clockOffsetRef.current;
  const ended = mapData.sessionStatus === "ended";
  const selfMembershipId = mapData.self?.membershipId ?? null;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: detail.session.title,
          headerRight: () => (
            <Pressable onPress={shareInvite} hitSlop={8}>
              <Text style={[styles.headerAction, { color: theme.tint }]}>共有</Text>
            </Pressable>
          ),
        }}
      />
      <View style={styles.header}>
        <Text style={[styles.meta, { color: theme.secondaryLabel }]}>
          メンバー {detail.members.length}人 ・ 招待コード {detail.session.inviteCode}
        </Text>
        {ended ? (
          <Text style={[styles.endedBanner, { color: theme.destructive }]}>
            このセッションは終了しました。追跡は停止しています。
          </Text>
        ) : (
          <View>
            <Text style={[styles.countdown, { color: theme.label }]}>
              次回開示まで{" "}
              {mapData.nextDisclosureAt !== null
                ? formatCountdown(mapData.nextDisclosureAt - serverNow)
                : "—"}
            </Text>
            <Text style={[styles.meta, { color: theme.secondaryLabel }]}>
              終了まで {formatCountdown(detail.session.expiresAt - serverNow)}
            </Text>
          </View>
        )}
      </View>

      <SessionMap
        locations={mapData.locations}
        self={mapData.self}
        selfMembershipId={selfMembershipId}
        tracks={showHistory ? (history?.tracks ?? []) : []}
      />

      <View style={styles.footer}>
        <View style={styles.historyRow}>
          <Text style={[styles.historyLabel, { color: theme.label }]}>移動履歴を表示</Text>
          <Switch value={showHistory} onValueChange={setShowHistory} />
        </View>
        {showHistory && (history?.tracks.length ?? 0) === 0 ? (
          <Text style={[styles.historyEmpty, { color: theme.secondaryLabel }]}>
            開示済みの履歴はまだありません
          </Text>
        ) : null}
        {!ended &&
          (tracking ? (
            <ActionButton title="共有を停止" onPress={stopSharing} variant="destructive" />
          ) : (
            <ActionButton title="位置共有を開始" onPress={startSharing} variant="prominent" />
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  countdown: {
    fontSize: 22,
    fontVariant: ["tabular-nums"],
    fontWeight: "bold",
  },
  endedBanner: {
    fontWeight: "bold",
  },
  footer: {
    gap: 8,
    padding: 16,
  },
  header: {
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerAction: {
    fontSize: 17,
  },
  historyEmpty: {
    fontSize: 12,
    textAlign: "center",
  },
  historyLabel: {
    fontSize: 16,
  },
  historyRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  meta: {
    fontSize: 13,
  },
});
