import { useRouter } from "expo-router";
import { Alert } from "react-native";

import { Controller, useForm } from "react-hook-form";

import { FormButton } from "#/components/ui/form-button";
import { FormSection } from "#/components/ui/form-section";
import { FormTextField } from "#/components/ui/form-text-field";
import { apiFetch } from "#/lib/api-client";
import { useAuth } from "#/lib/queries";
import { sessionWithMembershipResponseSchema } from "@intervalmap/shared";

type FormValues = {
  inviteCode: string;
};

export const SessionJoinForm = () => {
  const router = useRouter();
  const { data: auth } = useAuth();
  const { control, handleSubmit, formState } = useForm<FormValues>({
    defaultValues: { inviteCode: "" },
  });

  const onSubmit = handleSubmit(
    async ({ inviteCode }) => {
      if (!auth) {
        Alert.alert("表示名が未登録です", "設定タブで表示名を登録してください");
        return;
      }
      try {
        const res = await apiFetch(sessionWithMembershipResponseSchema, "/sessions/join", {
          method: "POST",
          token: auth.token,
          body: JSON.stringify({ inviteCode: inviteCode.trim() }),
        });
        router.push(`/session/${res.session.id}`);
      } catch (error) {
        Alert.alert("参加に失敗しました", error instanceof Error ? error.message : String(error));
      }
    },
    () => Alert.alert("入力エラー", "招待コードを入力してください"),
  );

  return (
    <>
      <FormSection title="招待コードで参加">
        <Controller
          control={control}
          name="inviteCode"
          rules={{ validate: (value) => value.trim() !== "" }}
          render={({ field }) => (
            <FormTextField label="招待コード" value={field.value} onChangeText={field.onChange} />
          )}
        />
      </FormSection>
      <FormButton title="参加する" onPress={onSubmit} disabled={formState.isSubmitting} />
    </>
  );
};
