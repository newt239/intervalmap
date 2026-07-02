import { Alert, Share } from "react-native";

import { FormButton } from "#/components/ui/form-button";
import { FormLabelValue } from "#/components/ui/form-label-value";
import { FormScreen } from "#/components/ui/form-screen";
import { FormSection } from "#/components/ui/form-section";
import { LoadingView } from "#/components/ui/loading-view";
import { MessageView } from "#/components/ui/message-view";
import { useAuth, useSessionDetail } from "#/lib/queries";

type Props = {
  sessionId: string;
};

export const InviteShare = ({ sessionId }: Props) => {
  const { data: auth } = useAuth();
  const detail = useSessionDetail(sessionId, auth?.token);
  const session = detail.data?.session;

  if (auth === null) {
    return <MessageView message="先にホーム画面で表示名を登録してください" />;
  }
  if (detail.isError) {
    return <MessageView message={detail.error.message} />;
  }
  if (!session) {
    return <LoadingView />;
  }

  const shareCode = (code: string, mode: string) => {
    Share.share({
      message: `「${session.title}」に${mode}で参加してください。招待コード: ${code}`,
    }).catch(() => {
      Alert.alert("共有に失敗しました", "もう一度お試しください");
    });
  };

  return (
    <FormScreen insetTop={false}>
      <FormSection
        title="位置を共有して参加"
        footer="このコードで参加したメンバーは自分の位置を共有します"
      >
        <FormLabelValue label="招待コード" value={session.inviteCode} tone="muted" />
      </FormSection>
      <FormButton
        title="共有用コードを送る"
        onPress={() => shareCode(session.inviteCode, "位置共有メンバー")}
      />

      <FormSection
        title="閲覧のみで参加"
        footer="このコードで参加したメンバーは位置を共有せず、開示された位置を見るだけです"
      >
        <FormLabelValue label="招待コード" value={session.viewerInviteCode} tone="muted" />
      </FormSection>
      <FormButton
        title="閲覧用コードを送る"
        onPress={() => shareCode(session.viewerInviteCode, "閲覧メンバー")}
      />
    </FormScreen>
  );
};
