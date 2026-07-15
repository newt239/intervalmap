import { ExtendedFloatingActionButton, Host, Text } from "@expo/ui/jetpack-compose";

import type { FabProps } from "./types";

// Material 3 の Extended FAB。アイコンアセットを持たないためラベルのみで表す。
export const Fab = ({ title, onPress }: FabProps) => (
  <Host matchContents>
    <ExtendedFloatingActionButton onClick={onPress}>
      <ExtendedFloatingActionButton.Text>
        <Text>{title}</Text>
      </ExtendedFloatingActionButton.Text>
    </ExtendedFloatingActionButton>
  </Host>
);
