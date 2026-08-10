import { LocationPermissionSettings } from "#/components/block/location-permission-settings";
import { FormScreen } from "#/components/ui/form-screen";

const LocationPermissionScreen = () => (
  <FormScreen insetTop={false}>
    <LocationPermissionSettings />
  </FormScreen>
);

export default LocationPermissionScreen;
