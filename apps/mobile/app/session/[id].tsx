import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, Share, StyleSheet, Text, View } from "react-native";

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
    return (
      <View style={styles.loading}>
        <Text>読み込み中…</Text>
      </View>
    );
  }

  const serverNow = nowTick + clockOffsetRef.current;
  const ended = mapData.sessionStatus === "ended";
  const selfMembershipId = mapData.self?.membershipId ?? null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{detail.session.title}</Text>
        <Text style={styles.meta}>
          メンバー {detail.members.length}人 ・ 招待コード {detail.session.inviteCode}
        </Text>
        {ended ? (
          <Text style={styles.endedBanner}>
            このセッションは終了しました。追跡は停止しています。
          </Text>
        ) : (
          <View>
            <Text style={styles.countdown}>
              次回開示まで{" "}
              {mapData.nextDisclosureAt !== null
                ? formatCountdown(mapData.nextDisclosureAt - serverNow)
                : "—"}
            </Text>
            <Text style={styles.meta}>
              終了まで {formatCountdown(detail.session.expiresAt - serverNow)}
            </Text>
          </View>
        )}
      </View>

      <SessionMap
        locations={mapData.locations}
        self={mapData.self}
        selfMembershipId={selfMembershipId}
      />

      <View style={styles.footer}>
        {!ended &&
          (tracking ? (
            <Pressable style={styles.stopButton} onPress={stopSharing}>
              <Text style={styles.buttonText}>共有を停止</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.startButton} onPress={startSharing}>
              <Text style={styles.buttonText}>位置共有を開始</Text>
            </Pressable>
          ))}
        <Pressable style={styles.inviteButton} onPress={shareInvite}>
          <Text style={styles.inviteButtonText}>招待コードを共有</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
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
    color: "#b91c1c",
    fontWeight: "bold",
  },
  footer: {
    gap: 8,
    padding: 16,
  },
  header: {
    gap: 4,
    padding: 16,
  },
  inviteButton: {
    alignItems: "center",
    borderColor: "#2563eb",
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  inviteButtonText: {
    color: "#2563eb",
    fontWeight: "bold",
  },
  loading: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  meta: {
    color: "#555",
    fontSize: 13,
  },
  startButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 8,
    padding: 14,
  },
  stopButton: {
    alignItems: "center",
    backgroundColor: "#b91c1c",
    borderRadius: 8,
    padding: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
});
