import { useLocalSearchParams } from "expo-router";

import { SessionDetail } from "#/components/block/session-detail";

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SessionDetail sessionId={id} />;
}
