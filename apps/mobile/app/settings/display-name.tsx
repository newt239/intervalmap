import { DisplayNameForm } from "#/components/block/display-name-form";
import { FormScreen } from "#/components/ui/form-screen";

export default function DisplayNameScreen() {
  return (
    <FormScreen insetTop={false}>
      <DisplayNameForm />
    </FormScreen>
  );
}
