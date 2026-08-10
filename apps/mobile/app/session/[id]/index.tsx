import { useLocalSearchParams } from "expo-router";

import { SessionDetail } from "#/components/block/session-detail";

const SessionScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SessionDetail sessionId={id} />;
};

export default SessionScreen;
