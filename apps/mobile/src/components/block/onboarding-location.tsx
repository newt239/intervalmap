import * as Location from "expo-location";
import { useRouter } from "expo-router";

import { useMutation } from "@tanstack/react-query";

import { FormButton } from "#/components/ui/form-button";
import { FormSection } from "#/components/ui/form-section";

export const OnboardingLocation = () => {
  const router = useRouter();
  const advance = () => {
    router.replace("/onboarding/notifications");
  };
  // 拒否されても次のステップへ進める。設定ページからいつでも変更できる。
  const request = useMutation({
    mutationFn: async () => Location.requestForegroundPermissionsAsync(),
    onSettled: advance,
  });

  return (
    <>
      <FormSection footer="セッション参加中に位置を共有するために使います。あとで設定からも変更できます">
        <FormButton
          title="位置情報を許可"
          onPress={() => {
            request.mutate();
          }}
          disabled={request.isPending}
        />
      </FormSection>
      <FormButton title="あとで" variant="secondary" onPress={advance} />
    </>
  );
};
