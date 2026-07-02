import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

import { FormButton } from "#/components/form-button";
import { FormPicker } from "#/components/form-picker";
import { FormScreen } from "#/components/form-screen";
import { FormSection } from "#/components/form-section";
import { FormTextField } from "#/components/form-text-field";
import { loadAuth } from "#/features/auth/auth-store";
import { apiFetch } from "#/lib/api-client";
import { sessionWithMembershipResponseSchema } from "@intervalmap/shared";

import type { StoredAuth } from "#/features/auth/auth-store";

// 開示インターバルとセッション有効期間のプリセット。
const INTERVAL_OPTIONS = [
  { label: "30秒", value: 30 },
  { label: "1分", value: 60 },
  { label: "5分", value: 300 },
  { label: "15分", value: 900 },
  { label: "1時間", value: 3600 },
];

const DURATION_OPTIONS = [
  { label: "30分", value: 1800 },
  { label: "1時間", value: 3600 },
  { label: "3時間", value: 10800 },
  { label: "24時間", value: 86400 },
];

// ホーム画面。セッションの新規作成と招待コードでの参加。表示名の登録は設定タブで行う。
export default function HomeScreen() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [intervalSec, setIntervalSec] = useState(300);
  const [durationSec, setDurationSec] = useState(3600);
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);

  const requireAuth = async (): Promise<StoredAuth | null> => {
    const auth = await loadAuth();
    if (!auth) {
      Alert.alert("表示名が未登録です", "設定タブで表示名を登録してください");
      return null;
    }
    return auth;
  };

  const onCreate = async () => {
    if (!title.trim()) {
      Alert.alert("入力エラー", "セッション名を入力してください");
      return;
    }
    setBusy(true);
    try {
      const auth = await requireAuth();
      if (!auth) {
        return;
      }
      const res = await apiFetch(sessionWithMembershipResponseSchema, "/sessions", {
        method: "POST",
        token: auth.token,
        body: JSON.stringify({ title: title.trim(), intervalSec, durationSec }),
      });
      router.push(`/session/${res.session.id}`);
    } catch (error) {
      Alert.alert("作成に失敗しました", error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const onJoin = async () => {
    const code = inviteCode.trim();
    if (!code) {
      Alert.alert("入力エラー", "招待コードを入力してください");
      return;
    }
    setBusy(true);
    try {
      const auth = await requireAuth();
      if (!auth) {
        return;
      }
      const res = await apiFetch(sessionWithMembershipResponseSchema, "/sessions/join", {
        method: "POST",
        token: auth.token,
        body: JSON.stringify({ inviteCode: code }),
      });
      router.push(`/session/${res.session.id}`);
    } catch (error) {
      Alert.alert("参加に失敗しました", error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen title="intervalmap">
      <FormSection title="セッションを作成" footer="期限が来ると追跡は自動的に停止します">
        <FormTextField
          label="セッション名"
          placeholder="例: 鬼ごっこ"
          value={title}
          onChangeText={setTitle}
        />
        <FormPicker
          label="開示インターバル"
          options={INTERVAL_OPTIONS}
          selected={intervalSec}
          onSelect={setIntervalSec}
        />
        <FormPicker
          label="有効期間"
          options={DURATION_OPTIONS}
          selected={durationSec}
          onSelect={setDurationSec}
        />
      </FormSection>
      <FormButton title="作成する" onPress={onCreate} disabled={busy} />

      <FormSection title="招待コードで参加">
        <FormTextField label="招待コード" value={inviteCode} onChangeText={setInviteCode} />
      </FormSection>
      <FormButton title="参加する" onPress={onJoin} disabled={busy} />
    </FormScreen>
  );
}
