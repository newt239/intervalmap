import { OnboardingLocation } from "#/components/block/onboarding-location";
import { FormScreen } from "#/components/ui/form-screen";

export default function OnboardingLocationScreen() {
  return (
    <FormScreen title="位置情報の利用">
      <OnboardingLocation />
    </FormScreen>
  );
}
