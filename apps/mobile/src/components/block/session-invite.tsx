import { Alert, Share, StyleSheet, View } from "react-native";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import QRCode from "react-native-qrcode-svg";

import { FormButton } from "#/components/ui/form-button";
import { FormLabelValue } from "#/components/ui/form-label-value";
import { FormScreen } from "#/components/ui/form-screen";
import { FormSection } from "#/components/ui/form-section";
import { LoadingView } from "#/components/ui/loading-view";
import { MessageView } from "#/components/ui/message-view";
import { apiFetch } from "#/lib/api-client";
import { sessionDetailQueryKey, useAuth, useSessionDetail } from "#/lib/queries";
import { INVITE_URL_BASE, sessionResponseSchema } from "@intervalmap/shared";

type Props = {
  sessionId: string;
};

// セッションに1本の常設招待リンク。コードはサーバーが主催者にしか返さない。
export const SessionInvite = ({ sessionId }: Props) => {
  const queryClient = useQueryClient();
  const { data: auth } = useAuth();
  const detail = useSessionDetail(sessionId, auth?.token);

  const regenerateMutation = useMutation({
    mutationFn: async () =>
      apiFetch(sessionResponseSchema, `/sessions/${sessionId}/invite/regenerate`, {
        method: "POST",
        token: auth?.token,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: sessionDetailQueryKey(sessionId) });
    },
    onError: (error) => {
      Alert.alert("再生成できませんでした", error.message);
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
  if (session.inviteCode === null) {
    return <MessageView message="招待リンクの共有は主催者のみ行えます" />;
  }

  const url = `${INVITE_URL_BASE}/join/${session.inviteCode}`;

  const shareInvite = () => {
    Share.share({ message: `「${session.title}」に参加してください ${url}` }).catch(() => {
      Alert.alert("共有に失敗しました", "もう一度お試しください");
    });
  };

  const confirmRegenerate = () => {
    Alert.alert(
      "招待リンクを再生成しますか?",
      "これまでのリンクと QR からは参加できなくなります。参加済みのメンバーには影響しません。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "再生成する",
          style: "destructive",
          onPress: () => {
            regenerateMutation.mutate();
          },
        },
      ],
    );
  };

  return (
    <FormScreen insetTop={false}>
      <FormSection footer="リンクを知っている人はだれでも参加でき、位置の共有と閲覧ができます">
        <FormLabelValue label="リンク" value={url} tone="muted" />
      </FormSection>
      <View style={styles.qrWrap}>
        <View style={styles.qrCard}>
          <QRCode value={url} size={200} backgroundColor="white" />
        </View>
      </View>
      <FormButton title="リンクを共有" onPress={shareInvite} />
      <FormButton
        title="リンクを再生成"
        variant="secondary"
        onPress={confirmRegenerate}
        disabled={regenerateMutation.isPending}
      />
    </FormScreen>
  );
};

const styles = StyleSheet.create({
  qrCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
  },
  qrWrap: {
    alignItems: "center",
    paddingVertical: 8,
  },
});
