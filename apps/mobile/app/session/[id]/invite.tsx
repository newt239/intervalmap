import { useLocalSearchParams } from "expo-router";

import { InviteShare } from "#/components/block/invite-share";

export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <InviteShare sessionId={id} />;
}
