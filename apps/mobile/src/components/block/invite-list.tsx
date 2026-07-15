import { useRouter } from "expo-router";
import { Alert } from "react-native";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";

import { FormButton } from "#/components/ui/form-button";
import { FormLabelValue } from "#/components/ui/form-label-value";
import { FormLink } from "#/components/ui/form-link";
import { FormScreen } from "#/components/ui/form-screen";
import { FormSection } from "#/components/ui/form-section";
import { FormSwitch } from "#/components/ui/form-switch";
import { LoadingView } from "#/components/ui/loading-view";
import { MessageView } from "#/components/ui/message-view";
import { apiFetch } from "#/lib/api-client";
import {
  sessionInvitesQueryKey,
  useAuth,
  useSessionDetail,
  useSessionInvites,
} from "#/lib/queries";
import { inviteResponseSchema, type CreateInviteInput, type Invite } from "@intervalmap/shared";

type Props = {
  sessionId: string;
};

const permissionLabel = (invite: Invite): string => {
  if (invite.allowSharing && invite.allowViewing) {
    return "位置共有+閲覧";
  }
  return invite.allowSharing ? "位置共有のみ" : "閲覧のみ";
};

const formatIssuedAt = (ms: number): string =>
  new Date(ms).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export const InviteList = ({ sessionId }: Props) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: auth } = useAuth();
  const detail = useSessionDetail(sessionId, auth?.token);
  const isOwner = detail.data?.session.ownerId === auth?.userId;
  const invitesQuery = useSessionInvites(sessionId, isOwner ? auth?.token : undefined);

  const { control, handleSubmit, formState } = useForm<CreateInviteInput>({
    defaultValues: { allowSharing: true, allowViewing: true },
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateInviteInput) =>
      apiFetch(inviteResponseSchema, `/sessions/${sessionId}/invites`, {
        method: "POST",
        token: auth?.token,
        body: JSON.stringify(input),
      }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: sessionInvitesQueryKey(sessionId) });
      router.push(`/session/${sessionId}/invite/${res.invite.id}`);
    },
    onError: (error) => {
      Alert.alert("招待を発行できませんでした", error.message);
    },
  });

  const onSubmit = handleSubmit((input) => {
    if (!input.allowSharing && !input.allowViewing) {
      Alert.alert("入力エラー", "少なくとも一方の権限を含めてください");
      return;
    }
    createMutation.mutate(input);
  });

  if (auth === null) {
    return <MessageView message="先にわたしタブで表示名を登録してください" />;
  }
  if (detail.isError) {
    return <MessageView message={detail.error.message} />;
  }
  if (!detail.data) {
    return <LoadingView />;
  }
  if (!isOwner) {
    return <MessageView message="招待の発行は主催者のみ行えます" />;
  }
  if (invitesQuery.isError) {
    return <MessageView message={invitesQuery.error.message} />;
  }
  if (!invitesQuery.data) {
    return <LoadingView />;
  }

  const active = invitesQuery.data.invites.filter((invite) => invite.revokedAt === null);
  const revoked = invitesQuery.data.invites.filter((invite) => invite.revokedAt !== null);

  return (
    <FormScreen insetTop={false}>
      <FormSection
        title="新しい招待"
        footer="招待に含めた権限が、参加したメンバーにできることの上限になります"
      >
        <Controller
          control={control}
          name="allowSharing"
          render={({ field }) => (
            <FormSwitch
              label="位置共有を含める"
              value={field.value}
              onValueChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="allowViewing"
          render={({ field }) => (
            <FormSwitch label="閲覧を含める" value={field.value} onValueChange={field.onChange} />
          )}
        />
      </FormSection>
      <FormButton
        title="招待を発行"
        onPress={() => {
          void onSubmit();
        }}
        disabled={formState.isSubmitting || createMutation.isPending}
      />

      {active.length > 0 ? (
        <FormSection title="有効な招待">
          {active.map((invite) => (
            <FormLink
              key={invite.id}
              label={`${permissionLabel(invite)} ・ ${formatIssuedAt(invite.createdAt)}`}
              onPress={() => {
                router.push(`/session/${sessionId}/invite/${invite.id}`);
              }}
            />
          ))}
        </FormSection>
      ) : null}
      {revoked.length > 0 ? (
        <FormSection title="失効済みの招待">
          {revoked.map((invite) => (
            <FormLabelValue
              key={invite.id}
              label={permissionLabel(invite)}
              value={formatIssuedAt(invite.createdAt)}
              tone="muted"
            />
          ))}
        </FormSection>
      ) : null}
    </FormScreen>
  );
};
