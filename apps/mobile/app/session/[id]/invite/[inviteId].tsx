import { useLocalSearchParams } from "expo-router";

import { InviteDetail } from "#/components/block/invite-detail";

export default function InviteDetailScreen() {
  const { id, inviteId } = useLocalSearchParams<{ id: string; inviteId: string }>();
  return <InviteDetail sessionId={id} inviteId={inviteId} />;
}
