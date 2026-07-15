import { useRouter } from "expo-router";
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
import {
  sessionInvitesQueryKey,
  useAuth,
  useSessionDetail,
  useSessionInvites,
} from "#/lib/queries";
import { INVITE_URL_BASE, inviteResponseSchema, type Invite } from "@intervalmap/shared";

type Props = {
  sessionId: string;
  inviteId: string;
};

const permissionLabel = (invite: Invite): string => {
  if (invite.allowSharing && invite.allowViewing) {
    return "位置共有+閲覧";
  }
  return invite.allowSharing ? "位置共有のみ" : "閲覧のみ";
};

export const InviteDetail = ({ sessionId, inviteId }: Props) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: auth } = useAuth();
  const detail = useSessionDetail(sessionId, auth?.token);
  const isOwner = detail.data?.session.ownerId === auth?.userId;
  const invitesQuery = useSessionInvites(sessionId, isOwner ? auth?.token : undefined);
  const invite = invitesQuery.data?.invites.find((i) => i.id === inviteId) ?? null;

  const revokeMutation = useMutation({
    mutationFn: async () =>
      apiFetch(inviteResponseSchema, `/sessions/${sessionId}/invites/${inviteId}`, {
        method: "DELETE",
        token: auth?.token,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: sessionInvitesQueryKey(sessionId) });
      router.back();
    },
    onError: (error) => {
      Alert.alert("失効できませんでした", error.message);
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
  if (!isOwner) {
    return <MessageView message="招待の確認は主催者のみ行えます" />;
  }
  if (invitesQuery.isError) {
    return <MessageView message={invitesQuery.error.message} />;
  }
  if (!invitesQuery.data) {
    return <LoadingView />;
  }
  if (!invite) {
    return <MessageView message="招待が見つかりません" />;
  }

  const url = `${INVITE_URL_BASE}/join/${invite.code}`;
  const { title } = detail.data.session;

  const shareInvite = () => {
    Share.share({ message: `「${title}」に参加してください ${url}` }).catch(() => {
      Alert.alert("共有に失敗しました", "もう一度お試しください");
    });
  };

  const confirmRevoke = () => {
    Alert.alert(
      "この招待を失効させますか?",
      "失効するとこのリンクからは参加できなくなります。参加済みのメンバーには影響しません。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "失効させる",
          style: "destructive",
          onPress: () => {
            revokeMutation.mutate();
          },
        },
      ],
    );
  };

  return (
    <FormScreen insetTop={false}>
      <FormSection footer="招待に含めた権限が、参加したメンバーにできることの上限になります">
        <FormLabelValue label="権限" value={permissionLabel(invite)} />
        <FormLabelValue label="リンク" value={url} tone="muted" />
      </FormSection>
      {invite.revokedAt === null ? (
        <>
          <View style={styles.qrWrap}>
            <View style={styles.qrCard}>
              <QRCode value={url} size={200} backgroundColor="white" />
            </View>
          </View>
          <FormButton title="リンクを共有" onPress={shareInvite} />
          <FormButton
            title="この招待を失効させる"
            variant="secondary"
            onPress={confirmRevoke}
            disabled={revokeMutation.isPending}
          />
        </>
      ) : (
        <FormSection footer="この招待は失効済みです。参加してもらうには新しい招待を発行してください。">
          <FormLabelValue
            label="失効日時"
            value={new Date(invite.revokedAt).toLocaleString("ja-JP")}
            tone="muted"
          />
        </FormSection>
      )}
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
