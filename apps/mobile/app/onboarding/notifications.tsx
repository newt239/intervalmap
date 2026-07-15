import { OnboardingNotifications } from "#/components/block/onboarding-notifications";
import { FormScreen } from "#/components/ui/form-screen";

export default function OnboardingNotificationsScreen() {
  return (
    <FormScreen title="通知の受け取り">
      <OnboardingNotifications />
    </FormScreen>
  );
}
