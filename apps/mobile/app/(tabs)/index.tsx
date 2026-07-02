import { SessionCreateForm } from "#/components/block/session-create-form";
import { SessionJoinForm } from "#/components/block/session-join-form";
import { FormScreen } from "#/components/ui/form-screen";

export default function HomeScreen() {
  return (
    <FormScreen title="intervalmap">
      <SessionCreateForm />
      <SessionJoinForm />
    </FormScreen>
  );
}
