import { Stack, useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { SessionMap } from "#/components/block/session-map";
import { ActionButton } from "#/components/ui/action-button";
import { LoadingView } from "#/components/ui/loading-view";
import { MessageView } from "#/components/ui/message-view";
import { useTheme } from "#/components/ui/theme";
import { locationTracker, useTrackerStatus } from "#/lib/location/tracker";
import { useAuth, useSessionDetail, useSessionMap } from "#/lib/queries";
import { useNow } from "#/lib/use-now";

type Props = {
  sessionId: string;
};

const two = (n: number) => String(n).padStart(2, "0");

// 残り時間の表示フォーマット。負値は 0 に丸める。
const formatCountdown = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
};

const stopSharing = () => {
  locationTracker.stop().catch(() => {});
};

// セッション地図画面の実装。表示は最新開示時点のメンバー位置と自分の現在位置のみ。
export const SessionDetail = ({ sessionId }: Props) => {
  const router = useRouter();
  const theme = useTheme();
  const { data: auth } = useAuth();
  const detailQuery = useSessionDetail(sessionId, auth?.token);
  const mapQuery = useSessionMap(sessionId, auth?.token);
  const tracking = useTrackerStatus() === "tracking";
  const now = useNow();

  if (auth === null) {
    return <MessageView message="先にわたしタブで表示名を登録してください" />;
  }
  if (detailQuery.isError) {
    return <MessageView message={detailQuery.error.message} />;
  }
  if (mapQuery.isError) {
    return <MessageView message={mapQuery.error.message} />;
  }
  const detail = detailQuery.data;
  const mapData = mapQuery.data;
  if (!detail || !mapData) {
    return <LoadingView />;
  }

  const startSharing = () => {
    if (!auth) {
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
            locationTracker.start(detail.session, { token: auth.token }).catch((error: unknown) => {
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

  // 端末時計に依存せず serverNow 基準で残り時間を出す。
  const serverNow = now + mapData.clockOffset;
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
              <Pressable
                onPress={() => {
                  router.push(`/session/${sessionId}/invite`);
                }}
                hitSlop={8}
              >
                <Text style={[styles.headerAction, { color: theme.tint }]}>招待</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  router.push(`/session/${sessionId}/settings`);
                }}
                hitSlop={8}
              >
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
              {mapData.nextDisclosureAt === null
                ? "—"
                : formatCountdown(mapData.nextDisclosureAt - serverNow)}
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
            onPress={() => {
              router.push(`/session/${sessionId}/member/${member.id}`);
            }}
          >
            <View style={styles.memberText}>
              <Text style={[styles.memberName, { color: theme.label }]}>
                {member.displayName}
                {member.id === selfMembershipId ? "（自分）" : ""}
              </Text>
              <Text style={[styles.meta, { color: theme.secondaryLabel }]}>
                {`${member.role === "owner" ? "主催" : "参加"} ・ ${
                  member.sharingEnabled ? "位置共有オン" : "位置共有オフ"
                }`}
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
};

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
