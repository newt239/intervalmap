import { NotificationSettings } from "#/components/block/notification-settings";
import { FormScreen } from "#/components/ui/form-screen";

export default function NotificationsScreen() {
  return (
    <FormScreen insetTop={false}>
      <NotificationSettings />
    </FormScreen>
  );
}
