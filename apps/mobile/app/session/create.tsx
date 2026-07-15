import { SessionCreateForm } from "#/components/block/session-create-form";
import { FormScreen } from "#/components/ui/form-screen";

export default function SessionCreateScreen() {
  return (
    <FormScreen insetTop={false}>
      <SessionCreateForm />
    </FormScreen>
  );
}
