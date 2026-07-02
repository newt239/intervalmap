import * as Notifications from "expo-notifications";
import { Alert, Linking } from "react-native";

import { useMutation, useQuery } from "@tanstack/react-query";

import { FormButton } from "#/components/ui/form-button";
import { FormLabelValue } from "#/components/ui/form-label-value";
import { FormSection } from "#/components/ui/form-section";
import { registerPushToken } from "#/lib/notifications";

const PERMISSION_LABELS: Record<Notifications.PermissionStatus, string> = {
  granted: "許可済み",
  denied: "拒否",
  undetermined: "未設定",
};

export const NotificationSettings = () => {
  // 設定アプリから戻ったときは AppState 連動の再取得で最新の権限状態を映す。
  const { data: status, refetch } = useQuery({
    queryKey: ["notification-permission"],
    queryFn: async () => (await Notifications.getPermissionsAsync()).status,
  });

  const register = useMutation({
    mutationFn: registerPushToken,
    onSuccess: (permission) => {
      if (!permission.granted && !permission.canAskAgain) {
        // OS のダイアログを出せない状態では設定アプリへ誘導する。
        Alert.alert("通知が拒否されています", "設定アプリから通知を許可してください", [
          { text: "キャンセル", style: "cancel" },
          { text: "設定を開く", onPress: () => Linking.openSettings() },
        ]);
      }
    },
    onSettled: () => refetch(),
  });

  return (
    <>
      <FormSection footer="位置の開示・セッション終了・無応答アラートをプッシュ通知で受け取れます">
        <FormLabelValue
          label="通知"
          value={status ? PERMISSION_LABELS[status] : "確認中"}
          tone={status === "granted" ? "success" : "muted"}
        />
      </FormSection>
      <FormButton
        title="通知を許可して登録"
        onPress={() => register.mutate()}
        disabled={register.isPending}
      />
      <FormButton
        title="設定アプリを開く"
        onPress={() => Linking.openSettings()}
        variant="secondary"
      />
    </>
  );
};
