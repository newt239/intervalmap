import { useLocalSearchParams } from "expo-router";

import { SessionInvite } from "#/components/block/session-invite";

export default function SessionInviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SessionInvite sessionId={id} />;
}
