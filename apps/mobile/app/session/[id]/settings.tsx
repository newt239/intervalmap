import { useLocalSearchParams } from "expo-router";

import { SessionSettings } from "#/components/block/session-settings";

const SessionSettingsScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SessionSettings sessionId={id} />;
};

export default SessionSettingsScreen;
