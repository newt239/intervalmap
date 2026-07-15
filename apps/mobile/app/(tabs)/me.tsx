import { useRouter } from "expo-router";

import { FormLink } from "#/components/ui/form-link";
import { FormScreen } from "#/components/ui/form-screen";
import { FormSection } from "#/components/ui/form-section";

export default function MeScreen() {
  const router = useRouter();
  return (
    <FormScreen title="わたし">
      <FormSection>
        <FormLink
          label="招待コードで参加"
          onPress={() => {
            router.push("/join");
          }}
        />
      </FormSection>
      <FormSection>
        <FormLink
          label="表示名"
          onPress={() => {
            router.push("/settings/display-name");
          }}
        />
        <FormLink
          label="位置情報の権限"
          onPress={() => {
            router.push("/settings/location-permission");
          }}
        />
        <FormLink
          label="通知"
          onPress={() => {
            router.push("/settings/notifications");
          }}
        />
      </FormSection>
    </FormScreen>
  );
}
