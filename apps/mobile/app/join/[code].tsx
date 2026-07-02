import { useLocalSearchParams } from "expo-router";

import { JoinByInviteForm } from "#/components/block/join-by-invite-form";
import { FormScreen } from "#/components/ui/form-screen";

export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return (
    <FormScreen insetTop={false}>
      <JoinByInviteForm code={code} />
    </FormScreen>
  );
}
