import { useRouter } from "expo-router";
import { Alert } from "react-native";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { FormButton } from "#/components/ui/form-button";
import { FormLabelValue } from "#/components/ui/form-label-value";
import { FormScreen } from "#/components/ui/form-screen";
import { FormSection } from "#/components/ui/form-section";
import { LoadingView } from "#/components/ui/loading-view";
import { MessageView } from "#/components/ui/message-view";
import { apiFetch } from "#/lib/api-client";
import { locationTracker } from "#/lib/location/tracker";
import { sessionDetailQueryKey, useAuth, useSessionDetail } from "#/lib/queries";
import { membershipResponseSchema, sessionResponseSchema } from "@intervalmap/shared";

type Props = {
  sessionId: string;
};

// セッションの終了と退出。どちらも端末側の追跡も併せて止める。
export const SessionSettings = ({ sessionId }: Props) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: auth } = useAuth();
  const detail = useSessionDetail(sessionId, auth?.token);

  const endMutation = useMutation({
    mutationFn: async () =>
      apiFetch(sessionResponseSchema, `/sessions/${sessionId}/end`, {
        method: "POST",
        token: auth?.token,
      }),
    onSuccess: async () => {
      await locationTracker.stop().catch(() => {});
      await queryClient.invalidateQueries({ queryKey: sessionDetailQueryKey(sessionId) });
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      router.back();
    },
    onError: (error) => {
      Alert.alert("終了できませんでした", error.message);
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async () =>
      apiFetch(membershipResponseSchema, `/sessions/${sessionId}/me`, {
        method: "DELETE",
        token: auth?.token,
      }),
    onSuccess: async () => {
      await locationTracker.stop().catch(() => {});
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      router.replace("/");
    },
    onError: (error) => {
      Alert.alert("退出できませんでした", error.message);
    },
  });

  if (auth === null) {
    return <MessageView message="先にわたしタブで表示名を登録してください" />;
  }
  if (detail.isError) {
    return <MessageView message={detail.error.message} />;
  }
  if (!detail.data) {
    return <LoadingView />;
  }

  const { session } = detail.data;
  const isOwner = session.ownerId === auth?.userId;
  const ended = session.status === "ended";

  const confirmEnd = () => {
    Alert.alert(
      "このセッションを終了しますか?",
      "全メンバーの位置共有が停止し、以降は誰も参加できなくなります。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "終了する",
          style: "destructive",
          onPress: () => {
            endMutation.mutate();
          },
        },
      ],
    );
  };

  const confirmLeave = () => {
    Alert.alert(
      "このセッションから退出しますか?",
      "位置の共有が止まり、地図と履歴から自分が消えます。招待リンクからいつでも再参加できます。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "退出する",
          style: "destructive",
          onPress: () => {
            leaveMutation.mutate();
          },
        },
      ],
    );
  };

  const footer = ended
    ? "このセッションは終了しています。追跡はすべて停止しました。"
    : isOwner
      ? "主催者は退出できません。共有を止めるにはセッションを終了してください。"
      : "退出すると位置の共有が止まり、地図と履歴から自分が消えます。";

  return (
    <FormScreen insetTop={false}>
      <FormSection title="セッション" footer={footer}>
        <FormLabelValue label="名前" value={session.title} />
        <FormLabelValue label="主催" value={isOwner ? "自分" : "他のメンバー"} tone="muted" />
      </FormSection>
      {ended ? null : isOwner ? (
        <FormButton
          title="セッションを終了"
          variant="secondary"
          onPress={confirmEnd}
          disabled={endMutation.isPending}
        />
      ) : (
        <FormButton
          title="セッションから退出"
          variant="secondary"
          onPress={confirmLeave}
          disabled={leaveMutation.isPending}
        />
      )}
    </FormScreen>
  );
};
