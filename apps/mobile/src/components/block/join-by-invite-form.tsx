import { useRouter } from "expo-router";
import { Alert } from "react-native";

import { Controller, useForm } from "react-hook-form";

import { FormButton } from "#/components/ui/form-button";
import { FormLabelValue } from "#/components/ui/form-label-value";
import { FormSection } from "#/components/ui/form-section";
import { FormTextField } from "#/components/ui/form-text-field";
import { apiFetch } from "#/lib/api-client";
import { ensureRegistered } from "#/lib/auth";
import { useAuth } from "#/lib/queries";
import { sessionWithMembershipResponseSchema } from "@intervalmap/shared";

type Props = {
  code: string | undefined;
};

type FormValues = {
  displayName: string;
};

export const JoinByInviteForm = ({ code }: Props) => {
  const router = useRouter();
  const { data: auth } = useAuth();
  const registered = auth != null;
  const { control, handleSubmit, formState } = useForm<FormValues>({
    values: { displayName: auth?.displayName ?? "" },
  });

  const onSubmit = handleSubmit(
    async ({ displayName }) => {
      if (!code) {
        Alert.alert("エラー", "招待コードがありません");
        return;
      }
      try {
        const nextAuth = await ensureRegistered(displayName.trim());
        const res = await apiFetch(sessionWithMembershipResponseSchema, "/sessions/join", {
          method: "POST",
          token: nextAuth.token,
          body: JSON.stringify({ inviteCode: code }),
        });
        router.replace(`/session/${res.session.id}`);
      } catch (error) {
        Alert.alert("参加に失敗しました", error instanceof Error ? error.message : String(error));
      }
    },
    () => {
      Alert.alert("入力エラー", "表示名を入力してください");
    },
  );

  return (
    <>
      <FormSection
        footer={`${
          registered ? "登録済みの表示名を使用します。" : ""
        }招待コードの種類によって位置共有のオン/オフが決まります。参加後にセッションの設定からいつでも変更できます。`}
      >
        <FormLabelValue label="招待コード" value={code ?? "不明"} tone="muted" />
        <Controller
          control={control}
          name="displayName"
          rules={{ validate: (value) => value.trim() !== "" }}
          render={({ field }) => (
            <FormTextField
              label="あなたの表示名"
              placeholder="例: たろう"
              value={field.value}
              onChangeText={field.onChange}
              disabled={registered}
            />
          )}
        />
      </FormSection>
      <FormButton
        title="参加する"
        onPress={() => {
          void onSubmit();
        }}
        disabled={formState.isSubmitting}
      />
    </>
  );
};
