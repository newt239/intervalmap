import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ActionButton } from "#/components/action-button";
import { LoadingView } from "#/components/loading-view";
import { useTheme } from "#/components/theme";
import { loadAuth } from "#/features/auth/auth-store";
import { locationTracker } from "#/features/location";
import { SessionMap } from "#/features/map/session-map";
import { apiFetch } from "#/lib/api-client";
import { mapResponseSchema, sessionDetailResponseSchema } from "@intervalmap/shared";

import type { StoredAuth } from "#/features/auth/auth-store";
import type { MapResponse, SessionDetailResponse } from "@intervalmap/shared";

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

  // 設定・招待ページから戻ったときも最新の状態を映す。
  useFocusEffect(
    useCallback(() => {
      refresh().catch((error) => {
        Alert.alert(
          "読み込みに失敗しました",
          error instanceof Error ? error.message : String(error),
        );
      });
    }, [refresh]),
  );

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

  if (!detail || !mapData) {
    return <LoadingView />;
  }

  const serverNow = nowTick + clockOffsetRef.current;
  const ended = mapData.sessionStatus === "ended";
  const selfMembership = detail.members.find((m) => m.userId === auth?.userId) ?? null;
  const selfMembershipId = selfMembership?.id ?? null;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: detail.session.title,
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable onPress={() => router.push(`/session/${id}/invite`)} hitSlop={8}>
                <Text style={[styles.headerAction, { color: theme.tint }]}>招待</Text>
              </Pressable>
              <Pressable onPress={() => router.push(`/session/${id}/settings`)} hitSlop={8}>
                <Text style={[styles.headerAction, { color: theme.tint }]}>設定</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <View style={styles.header}>
        <Text style={[styles.meta, { color: theme.secondaryLabel }]}>
          メンバー {detail.members.length}人
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
        tracks={[]}
      />

      <ScrollView style={styles.memberList} contentContainerStyle={styles.memberListContent}>
        <Text style={[styles.sectionTitle, { color: theme.secondaryLabel }]}>メンバー</Text>
        {detail.members.map((member) => (
          <Pressable
            key={member.id}
            style={styles.memberRow}
            onPress={() => router.push(`/session/${id}/member/${member.id}`)}
          >
            <View style={styles.memberText}>
              <Text style={[styles.memberName, { color: theme.label }]}>
                {member.displayName}
                {member.id === selfMembershipId ? "（自分）" : ""}
              </Text>
              <Text style={[styles.meta, { color: theme.secondaryLabel }]}>
                {`${member.role === "owner" ? "主催" : "参加" 
                  } ・ ${ 
                  member.sharingEnabled ? "位置共有オン" : "位置共有オフ"}`}
              </Text>
            </View>
            <Text style={[styles.chevron, { color: theme.secondaryLabel }]}>›</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        {!ended && selfMembership?.sharingEnabled === false ? (
          <Text style={[styles.meta, { color: theme.secondaryLabel }]}>
            位置共有はオフ設定です。ヘッダーの設定から変更できます。
          </Text>
        ) : null}
        {!ended &&
          selfMembership?.sharingEnabled === true &&
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
  chevron: {
    fontSize: 22,
  },
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
  headerActions: {
    flexDirection: "row",
    gap: 16,
  },
  memberList: {
    flexGrow: 0,
    maxHeight: 220,
  },
  memberListContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  memberName: {
    fontSize: 16,
  },
  memberRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  memberText: {
    gap: 2,
  },
  meta: {
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
  },
});
