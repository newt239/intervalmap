import { LocationPermissionSettings } from "#/components/block/location-permission-settings";
import { FormScreen } from "#/components/ui/form-screen";

export default function LocationPermissionScreen() {
  return (
    <FormScreen insetTop={false}>
      <LocationPermissionSettings />
    </FormScreen>
  );
}
