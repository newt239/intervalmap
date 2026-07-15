import { useLocalSearchParams } from "expo-router";

import { InviteList } from "#/components/block/invite-list";

export default function InviteListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <InviteList sessionId={id} />;
}
