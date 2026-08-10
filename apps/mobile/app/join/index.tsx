import { SessionJoinForm } from "#/components/block/session-join-form";
import { FormScreen } from "#/components/ui/form-screen";

const JoinIndexScreen = () => (
  <FormScreen insetTop={false}>
    <SessionJoinForm />
  </FormScreen>
);

export default JoinIndexScreen;
