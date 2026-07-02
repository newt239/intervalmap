import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Share } from "react-native";

import { FormButton } from "#/components/form-button";
import { FormLabelValue } from "#/components/form-label-value";
import { FormScreen } from "#/components/form-screen";
import { FormSection } from "#/components/form-section";
import { LoadingView } from "#/components/loading-view";
import { loadAuth } from "#/features/auth/auth-store";
import { apiFetch } from "#/lib/api-client";
import { sessionDetailResponseSchema } from "@intervalmap/shared";

import type { Session } from "@intervalmap/shared";

// 招待画面。共有用と閲覧用のどちらの招待コードを送るかをここで選ぶ。
export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }
    loadAuth()
      .then((auth) => {
        if (!auth) {
          throw new Error("先にホーム画面で表示名を登録してください");
        }
        return apiFetch(sessionDetailResponseSchema, `/sessions/${id}`, { token: auth.token });
      })
      .then((res) => setSession(res.session))
      .catch((error: unknown) => {
        Alert.alert(
          "読み込みに失敗しました",
          error instanceof Error ? error.message : String(error),
        );
      });
  }, [id]);

  if (!session) {
    return <LoadingView />;
  }

  const shareCode = (code: string, mode: string) => {
    Share.share({
      message: `「${session.title}」に${mode}で参加してください。招待コード: ${code}`,
    }).catch(() => {});
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
}
