import { Alert } from "react-native";

import { Controller, useForm } from "react-hook-form";

import { FormButton } from "#/components/ui/form-button";
import { FormSection } from "#/components/ui/form-section";
import { FormTextField } from "#/components/ui/form-text-field";
import { updateDisplayName } from "#/lib/auth";
import { useAuth } from "#/lib/queries";

type FormValues = {
  displayName: string;
};

export const DisplayNameForm = () => {
  const { data: auth } = useAuth();
  const registered = auth != null;
  const { control, handleSubmit, formState } = useForm<FormValues>({
    values: { displayName: auth?.displayName ?? "" },
  });

  const onSubmit = handleSubmit(
    async ({ displayName }) => {
      try {
        const next = await updateDisplayName(displayName.trim());
        Alert.alert("保存しました", `表示名を「${next.displayName}」にしました`);
      } catch (error) {
        Alert.alert("保存に失敗しました", error instanceof Error ? error.message : String(error));
      }
    },
    () => Alert.alert("入力エラー", "表示名を入力してください"),
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
        title={registered ? "変更を保存" : "登録する"}
        onPress={onSubmit}
        disabled={formState.isSubmitting}
      />
    </>
  );
};
