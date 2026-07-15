import { OnboardingDisplayNameForm } from "#/components/block/onboarding-display-name-form";
import { FormScreen } from "#/components/ui/form-screen";

export default function OnboardingDisplayNameScreen() {
  return (
    <FormScreen title="表示名を設定">
      <OnboardingDisplayNameForm />
    </FormScreen>
  );
}
