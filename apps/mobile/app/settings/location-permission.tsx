import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Linking } from "react-native";

import { FormButton } from "#/components/form-button";
import { FormLabelValue } from "#/components/form-label-value";
import { FormScreen } from "#/components/form-screen";
import { FormSection } from "#/components/form-section";

const PERMISSION_LABELS: Record<Location.PermissionStatus, string> = {
  granted: "許可済み",
  denied: "拒否",
  undetermined: "未設定",
};

const permissionTone = (status: Location.PermissionStatus | null) =>
  status === "granted" ? "success" : "muted";

// 位置情報権限の確認とリクエスト。
export default function LocationPermissionScreen() {
  const [foreground, setForeground] = useState<Location.PermissionStatus | null>(null);
  const [background, setBackground] = useState<Location.PermissionStatus | null>(null);

  const refresh = useCallback(async () => {
    const fg = await Location.getForegroundPermissionsAsync();
    setForeground(fg.status);
    const bg = await Location.getBackgroundPermissionsAsync();
    setBackground(bg.status);
  }, []);

  // 設定アプリから戻ったときも最新の権限状態を映す。
  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, [refresh]),
  );

  const onRequestPermission = async () => {
    const fg = await Location.requestForegroundPermissionsAsync();
    setForeground(fg.status);
    if (!fg.granted && !fg.canAskAgain) {
      // OS のダイアログを出せない状態では設定アプリへ誘導する。
      Alert.alert("権限が拒否されています", "設定アプリから位置情報を許可してください", [
        { text: "キャンセル", style: "cancel" },
        { text: "設定を開く", onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    const bg = await Location.getBackgroundPermissionsAsync();
    setBackground(bg.status);
  };

  return (
    <FormScreen insetTop={false}>
      <FormSection footer="セッション参加中はアプリを閉じても共有を続けるため「常に許可」を推奨します">
        <FormLabelValue
          label="使用中の位置情報"
          value={foreground ? PERMISSION_LABELS[foreground] : "確認中"}
          tone={permissionTone(foreground)}
        />
        <FormLabelValue
          label="常に許可"
          value={background ? PERMISSION_LABELS[background] : "確認中"}
          tone={permissionTone(background)}
        />
      </FormSection>
      <FormButton title="権限を確認・リクエスト" onPress={onRequestPermission} />
      <FormButton
        title="設定アプリを開く"
        onPress={() => Linking.openSettings()}
        variant="secondary"
      />
    </FormScreen>
  );
}
