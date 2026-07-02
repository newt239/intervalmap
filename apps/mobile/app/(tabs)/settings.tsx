import { useRouter } from "expo-router";

import { FormLink } from "#/components/form-link";
import { FormScreen } from "#/components/form-screen";
import { FormSection } from "#/components/form-section";

// 設定タブ。メニューのみを置き、各設定は詳細ページで行う。
export default function SettingsScreen() {
  const router = useRouter();
  return (
    <FormScreen title="設定">
      <FormSection>
        <FormLink label="表示名" onPress={() => router.push("/settings/display-name")} />
        <FormLink
          label="位置情報の権限"
          onPress={() => router.push("/settings/location-permission")}
        />
      </FormSection>
    </FormScreen>
  );
}
