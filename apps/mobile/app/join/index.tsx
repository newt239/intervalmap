import { SessionJoinForm } from "#/components/block/session-join-form";
import { FormScreen } from "#/components/ui/form-screen";

export default function JoinIndexScreen() {
  return (
    <FormScreen insetTop={false}>
      <SessionJoinForm />
    </FormScreen>
  );
}
