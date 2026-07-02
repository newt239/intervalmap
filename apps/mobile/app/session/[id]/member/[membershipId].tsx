import { useLocalSearchParams } from "expo-router";

import { MemberDetail } from "#/components/block/member-detail";

export default function MemberScreen() {
  const { id, membershipId } = useLocalSearchParams<{ id: string; membershipId: string }>();
  return <MemberDetail sessionId={id} membershipId={membershipId} />;
}
