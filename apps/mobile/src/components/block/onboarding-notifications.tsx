import { useRouter } from "expo-router";

import { useMutation } from "@tanstack/react-query";

import { FormButton } from "#/components/ui/form-button";
import { FormSection } from "#/components/ui/form-section";
import { registerPushToken } from "#/lib/notifications";

export const OnboardingNotifications = () => {
  const router = useRouter();
  const finish = () => {
    router.replace("/(tabs)");
  };
  // 拒否されてもオンボーディングを完了する。設定ページからいつでも変更できる。
  const register = useMutation({
    mutationFn: registerPushToken,
    onSettled: finish,
  });

  return (
    <>
      <FormSection footer="位置の開示やセッション終了を通知で受け取れます。あとで設定からも変更できます">
        <FormButton
          title="通知を許可"
          onPress={() => {
            register.mutate();
          }}
          disabled={register.isPending}
        />
      </FormSection>
      <FormButton title="あとで" variant="secondary" onPress={finish} />
    </>
  );
};
