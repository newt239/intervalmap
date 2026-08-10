import { useLocalSearchParams } from "expo-router";

import { SessionInvite } from "#/components/block/session-invite";

const SessionInviteScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SessionInvite sessionId={id} />;
};

export default SessionInviteScreen;
