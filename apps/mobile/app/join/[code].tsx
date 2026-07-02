import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert } from "react-native";

import { FormButton } from "#/components/form-button";
import { FormLabelValue } from "#/components/form-label-value";
import { FormScreen } from "#/components/form-screen";
import { FormSection } from "#/components/form-section";
import { FormTextField } from "#/components/form-text-field";
import { ensureRegistered, loadAuth } from "#/features/auth/auth-store";
import { apiFetch } from "#/lib/api-client";
import { sessionWithMembershipResponseSchema } from "@intervalmap/shared";

// 招待リンク https://<domain>/join/<code> とディープリンクの受け口。
export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadAuth().then((auth) => {
      if (auth) {
        setDisplayName(auth.displayName);
        setRegistered(true);
      }
    });
  }, []);

  const onJoin = async () => {
    const name = displayName.trim();
    if (!name) {
      Alert.alert("入力エラー", "表示名を入力してください");
      return;
    }
    if (!code) {
      Alert.alert("エラー", "招待コードがありません");
      return;
    }
    setBusy(true);
    try {
      const auth = await ensureRegistered(name);
      const res = await apiFetch(sessionWithMembershipResponseSchema, "/sessions/join", {
        method: "POST",
        token: auth.token,
        body: JSON.stringify({ inviteCode: code }),
      });
      router.replace(`/session/${res.session.id}`);
    } catch (error) {
      Alert.alert("参加に失敗しました", error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen insetTop={false}>
      <FormSection
        footer={
          `${registered ? "登録済みの表示名を使用します。" : "" 
          }招待コードの種類によって位置共有のオン/オフが決まります。参加後にセッションの設定からいつでも変更できます。`
        }
      >
        <FormLabelValue label="招待コード" value={code ?? "不明"} tone="muted" />
        <FormTextField
          label="あなたの表示名"
          placeholder="例: たろう"
          value={displayName}
          onChangeText={setDisplayName}
          disabled={registered}
        />
      </FormSection>
      <FormButton title="参加する" onPress={onJoin} disabled={busy} />
    </FormScreen>
  );
}
