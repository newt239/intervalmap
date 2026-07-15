import { Alert } from "react-native";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { FormScreen } from "#/components/ui/form-screen";
import { FormSection } from "#/components/ui/form-section";
import { FormSwitch } from "#/components/ui/form-switch";
import { LoadingView } from "#/components/ui/loading-view";
import { MessageView } from "#/components/ui/message-view";
import { apiFetch } from "#/lib/api-client";
import { locationTracker } from "#/lib/location/tracker";
import { sessionDetailQueryKey, useAuth, useSessionDetail } from "#/lib/queries";
import {
  membershipResponseSchema,
  type SessionDetailResponse,
  type UpdateMembershipInput,
} from "@intervalmap/shared";

type Props = {
  sessionId: string;
};

// 共有設定の強制はサーバー側で行い、ここは表示と更新のみ。
export const SharingSettings = ({ sessionId }: Props) => {
  const queryClient = useQueryClient();
  const { data: auth } = useAuth();
  const detail = useSessionDetail(sessionId, auth?.token);
  const membership = detail.data?.members.find((m) => m.userId === auth?.userId) ?? null;

  const mutation = useMutation({
    mutationFn: async (patch: UpdateMembershipInput) =>
      apiFetch(membershipResponseSchema, `/sessions/${sessionId}/me`, {
        method: "PATCH",
        token: auth?.token,
        body: JSON.stringify(patch),
      }),
    onSuccess: (res, patch) => {
      queryClient.setQueryData<SessionDetailResponse>(sessionDetailQueryKey(sessionId), (prev) =>
        prev
          ? {
              ...prev,
              members: prev.members.map((m) => (m.id === res.membership.id ? res.membership : m)),
            }
          : prev,
      );
      // 共有をオフにしたら端末側の追跡も止める。
      if (patch.sharingEnabled === false) {
        locationTracker.stop().catch(() => {});
      }
    },
    onError: (error) => {
      Alert.alert("設定を変更できませんでした", error.message);
    },
  });

  if (auth === null) {
    return <MessageView message="先にわたしタブで表示名を登録してください" />;
  }
  if (detail.isError) {
    return <MessageView message={detail.error.message} />;
  }
  if (!membership) {
    return <LoadingView />;
  }

  return (
    <FormScreen insetTop={false}>
      <FormSection
        title="自分の位置"
        footer={
          membership.allowedSharing
            ? "オフにすると位置の送信が止まり、他のメンバーからは見えなくなります"
            : "この招待では位置共有は許可されていません"
        }
      >
        <FormSwitch
          label="自分の位置を共有"
          value={membership.sharingEnabled}
          onValueChange={(value) => {
            mutation.mutate({ sharingEnabled: value });
          }}
          disabled={!membership.allowedSharing}
        />
      </FormSection>
      <FormSection
        title="他のメンバーの位置"
        footer={
          membership.allowedViewing
            ? "オフにすると地図と履歴に他のメンバーが表示されなくなります"
            : "この招待では閲覧は許可されていません"
        }
      >
        <FormSwitch
          label="他のメンバーの位置を表示"
          value={membership.viewingEnabled}
          onValueChange={(value) => {
            mutation.mutate({ viewingEnabled: value });
          }}
          disabled={!membership.allowedViewing}
        />
      </FormSection>
    </FormScreen>
  );
};
