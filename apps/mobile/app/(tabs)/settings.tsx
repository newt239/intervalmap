import { useRouter } from "expo-router";

import { FormLink } from "#/components/ui/form-link";
import { FormScreen } from "#/components/ui/form-screen";
import { FormSection } from "#/components/ui/form-section";

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
