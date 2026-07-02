import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert } from "react-native";

import { FormScreen } from "#/components/form-screen";
import { FormSection } from "#/components/form-section";
import { FormSwitch } from "#/components/form-switch";
import { LoadingView } from "#/components/loading-view";
import { loadAuth } from "#/features/auth/auth-store";
import { locationTracker } from "#/features/location";
import { apiFetch } from "#/lib/api-client";
import { membershipResponseSchema, sessionDetailResponseSchema } from "@intervalmap/shared";

import type { StoredAuth } from "#/features/auth/auth-store";
import type { Membership, UpdateMembershipInput } from "@intervalmap/shared";

// セッションごとの自分の共有設定。強制はサーバー側で行い、ここは表示と更新のみ。
export default function SessionSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }
    loadAuth()
      .then(async (stored) => {
        if (!stored) {
          throw new Error("先にホーム画面で表示名を登録してください");
        }
        setAuth(stored);
        const detail = await apiFetch(sessionDetailResponseSchema, `/sessions/${id}`, {
          token: stored.token,
        });
        setMembership(detail.members.find((m) => m.userId === stored.userId) ?? null);
      })
      .catch((error: unknown) => {
        Alert.alert(
          "読み込みに失敗しました",
          error instanceof Error ? error.message : String(error),
        );
      });
  }, [id]);

  if (!membership) {
    return <LoadingView />;
  }

  // 共有をオフにしたら端末側の追跡も止める。
  const updateSettings = (patch: UpdateMembershipInput) => {
    if (!auth || !id) {
      return;
    }
    apiFetch(membershipResponseSchema, `/sessions/${id}/me`, {
      method: "PATCH",
      token: auth.token,
      body: JSON.stringify(patch),
    })
      .then((res) => {
        setMembership(res.membership);
        if (patch.sharingEnabled === false) {
          locationTracker.stop().catch(() => {});
        }
      })
      .catch((error: unknown) => {
        Alert.alert(
          "設定を変更できませんでした",
          error instanceof Error ? error.message : String(error),
        );
      });
  };

  return (
    <FormScreen insetTop={false}>
      <FormSection
        title="自分の位置"
        footer="オフにすると位置の送信が止まり、他のメンバーからは見えなくなります"
      >
        <FormSwitch
          label="自分の位置を共有"
          value={membership.sharingEnabled}
          onValueChange={(value) => updateSettings({ sharingEnabled: value })}
        />
      </FormSection>
      <FormSection
        title="他のメンバーの位置"
        footer="オフにすると地図と履歴に他のメンバーが表示されなくなります"
      >
        <FormSwitch
          label="他のメンバーの位置を表示"
          value={membership.viewingEnabled}
          onValueChange={(value) => updateSettings({ viewingEnabled: value })}
        />
      </FormSection>
    </FormScreen>
  );
}
