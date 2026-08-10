import { useLocalSearchParams } from "expo-router";

import { SessionSettings } from "#/components/block/session-settings";

export default function SessionSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SessionSettings sessionId={id} />;
}
