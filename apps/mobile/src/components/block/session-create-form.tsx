import { useRouter } from "expo-router";
import { Alert, Share } from "react-native";

import { Controller, useForm } from "react-hook-form";

import { FormButton } from "#/components/ui/form-button";
import { FormPicker } from "#/components/ui/form-picker";
import { FormSection } from "#/components/ui/form-section";
import { FormTextField } from "#/components/ui/form-text-field";
import { apiFetch } from "#/lib/api-client";
import { useAuth } from "#/lib/queries";
import { INVITE_URL_BASE, sessionWithMembershipResponseSchema } from "@intervalmap/shared";

// 開示インターバルのプリセット。終了は主催者が手動で行うため期間は選ばせない。
const INTERVAL_OPTIONS = [
  { label: "30秒", value: 30 },
  { label: "1分", value: 60 },
  { label: "5分", value: 300 },
  { label: "15分", value: 900 },
  { label: "1時間", value: 3600 },
];

type FormValues = {
  title: string;
  intervalSec: number;
};

export const SessionCreateForm = () => {
  const router = useRouter();
  const { data: auth } = useAuth();
  const { control, handleSubmit, formState } = useForm<FormValues>({
    defaultValues: { title: "", intervalSec: 300 },
  });

  const onSubmit = handleSubmit(
    async ({ title, intervalSec }) => {
      if (!auth) {
        Alert.alert("表示名が未登録です", "わたしタブで表示名を登録してください");
        return;
      }
      try {
        const res = await apiFetch(sessionWithMembershipResponseSchema, "/sessions", {
          method: "POST",
          token: auth.token,
          body: JSON.stringify({ title: title.trim(), intervalSec }),
        });
        // 作成直後にそのまま招待リンクを配れるようにする。キャンセルしても詳細へ進む。
        if (res.session.inviteCode !== null) {
          const url = `${INVITE_URL_BASE}/join/${res.session.inviteCode}`;
          await Share.share({ message: `「${res.session.title}」に参加してください ${url}` }).catch(
            () => {},
          );
        }
        router.replace(`/session/${res.session.id}`);
      } catch (error) {
        Alert.alert("作成に失敗しました", error instanceof Error ? error.message : String(error));
      }
    },
    () => {
      Alert.alert("入力エラー", "セッション名を入力してください");
    },
  );

  return (
    <>
      <FormSection title="セッションを作成" footer="作成すると招待リンクをすぐに共有できます">
        <Controller
          control={control}
          name="title"
          rules={{ validate: (value) => value.trim() !== "" }}
          render={({ field }) => (
            <FormTextField
              label="セッション名"
              placeholder="例: 家族でハイキング"
              value={field.value}
              onChangeText={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="intervalSec"
          render={({ field }) => (
            <FormPicker
              label="開示インターバル"
              options={INTERVAL_OPTIONS}
              selected={field.value}
              onSelect={field.onChange}
            />
          )}
        />
      </FormSection>
      <FormButton
        title="作成する"
        onPress={() => {
          void onSubmit();
        }}
        disabled={formState.isSubmitting}
      />
    </>
  );
};
