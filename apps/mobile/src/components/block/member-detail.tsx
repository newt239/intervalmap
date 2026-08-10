import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { SessionMap } from "#/components/block/session-map";
import { LoadingView } from "#/components/ui/loading-view";
import { MessageView } from "#/components/ui/message-view";
import { useTheme } from "#/components/ui/theme";
import { useAuth, useSessionDetail, useSessionHistory, useSessionMap } from "#/lib/queries";

type Props = {
  sessionId: string;
  membershipId: string;
};

const formatDateTime = (ms: number): string =>
  new Date(ms).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// メンバー詳細の実装。開示済みの最新位置と移動履歴のみ表示する。自分自身は現在位置も見える。
export const MemberDetail = ({ sessionId, membershipId }: Props) => {
  const theme = useTheme();
  const { data: auth } = useAuth();
  const detailQuery = useSessionDetail(sessionId, auth?.token);
  const mapQuery = useSessionMap(sessionId, auth?.token);
  const historyQuery = useSessionHistory(sessionId, auth?.token, mapQuery.data?.serverNow);

  if (auth === null) {
    return <MessageView message="先にわたしタブで表示名を登録してください" />;
  }
  const errorQuery = [detailQuery, mapQuery, historyQuery].find((q) => q.isError);
  if (errorQuery?.error) {
    return <MessageView message={errorQuery.error.message} />;
  }
  const detail = detailQuery.data;
  const mapData = mapQuery.data;
  const history = historyQuery.data;
  if (!detail || !mapData || !history) {
    return <LoadingView />;
  }

  const member = detail.members.find((m) => m.id === membershipId) ?? null;
  if (!member) {
    return <MessageView message="メンバーが見つかりません" />;
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
          {`${member.role === "owner" ? "主催" : "参加"} ・ 参加 ${formatDateTime(member.joinedAt)}`}
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
};

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
