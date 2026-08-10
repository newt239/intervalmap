import { SessionCreateForm } from "#/components/block/session-create-form";
import { FormScreen } from "#/components/ui/form-screen";

const SessionCreateScreen = () => (
  <FormScreen insetTop={false}>
    <SessionCreateForm />
  </FormScreen>
);

export default SessionCreateScreen;
