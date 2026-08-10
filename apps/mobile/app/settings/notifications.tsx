import { NotificationSettings } from "#/components/block/notification-settings";
import { FormScreen } from "#/components/ui/form-screen";

const NotificationsScreen = () => (
  <FormScreen insetTop={false}>
    <NotificationSettings />
  </FormScreen>
);

export default NotificationsScreen;
