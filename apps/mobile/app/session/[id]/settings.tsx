import { useLocalSearchParams } from "expo-router";

import { SharingSettings } from "#/components/block/sharing-settings";

export default function SessionSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SharingSettings sessionId={id} />;
}
