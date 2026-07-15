import { useRouter } from "expo-router";
import { Alert } from "react-native";

import { Controller, useForm } from "react-hook-form";

import { FormButton } from "#/components/ui/form-button";
import { FormSection } from "#/components/ui/form-section";
import { FormTextField } from "#/components/ui/form-text-field";
import { ensureRegistered } from "#/lib/auth";

type FormValues = {
  displayName: string;
};

export const OnboardingDisplayNameForm = () => {
  const router = useRouter();
  const { control, handleSubmit, formState } = useForm<FormValues>({
    defaultValues: { displayName: "" },
  });

  const onSubmit = handleSubmit(
    async ({ displayName }) => {
      try {
        await ensureRegistered(displayName.trim());
        router.replace("/onboarding/location");
      } catch (error) {
        Alert.alert("登録に失敗しました", error instanceof Error ? error.message : String(error));
      }
    },
    () => {
      Alert.alert("入力エラー", "表示名を入力してください");
    },
  );

  return (
    <>
      <FormSection footer="セッションで他のメンバーに表示される名前です">
        <Controller
          control={control}
          name="displayName"
          rules={{ validate: (value) => value.trim() !== "" }}
          render={({ field }) => (
            <FormTextField
              label="表示名"
              placeholder="例: たろう"
              value={field.value}
              onChangeText={field.onChange}
            />
          )}
        />
      </FormSection>
      <FormButton
        title="登録する"
        onPress={() => {
          void onSubmit();
        }}
        disabled={formState.isSubmitting}
      />
    </>
  );
};
