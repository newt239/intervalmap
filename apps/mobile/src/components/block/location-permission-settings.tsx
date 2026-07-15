import * as Location from "expo-location";
import { Alert, Linking } from "react-native";

import { useQuery } from "@tanstack/react-query";

import { FormButton } from "#/components/ui/form-button";
import { FormLabelValue } from "#/components/ui/form-label-value";
import { FormSection } from "#/components/ui/form-section";

const PERMISSION_LABELS: Record<Location.PermissionStatus, string> = {
  granted: "許可済み",
  denied: "拒否",
  undetermined: "未設定",
};

const permissionTone = (status: Location.PermissionStatus | undefined) =>
  status === Location.PermissionStatus.GRANTED ? "success" : "muted";

export const LocationPermissionSettings = () => {
  // 設定アプリから戻ったときは AppState 連動の再取得で最新の権限状態を映す。
  const { data: permissions, refetch } = useQuery({
    queryKey: ["location-permissions"],
    queryFn: async () => {
      const foreground = await Location.getForegroundPermissionsAsync();
      const background = await Location.getBackgroundPermissionsAsync();
      return { foreground: foreground.status, background: background.status };
    },
  });

  const onRequestPermission = async () => {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted && !fg.canAskAgain) {
      // OS のダイアログを出せない状態では設定アプリへ誘導する。
      Alert.alert("権限が拒否されています", "設定アプリから位置情報を許可してください", [
        { text: "キャンセル", style: "cancel" },
        {
          text: "設定を開く",
          onPress: () => {
            void Linking.openSettings();
          },
        },
      ]);
    }
    await refetch();
  };

  return (
    <>
      <FormSection footer="セッション参加中はアプリを閉じても共有を続けるため「常に許可」を推奨します">
        <FormLabelValue
          label="使用中の位置情報"
          value={permissions ? PERMISSION_LABELS[permissions.foreground] : "確認中"}
          tone={permissionTone(permissions?.foreground)}
        />
        <FormLabelValue
          label="常に許可"
          value={permissions ? PERMISSION_LABELS[permissions.background] : "確認中"}
          tone={permissionTone(permissions?.background)}
        />
      </FormSection>
      <FormButton
        title="権限を確認・リクエスト"
        onPress={() => {
          void onRequestPermission();
        }}
      />
      <FormButton
        title="設定アプリを開く"
        onPress={() => {
          void Linking.openSettings();
        }}
        variant="secondary"
      />
    </>
  );
};
