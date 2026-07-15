import { Button, Host, Image } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  padding,
} from "@expo/ui/swift-ui/modifiers";

import type { FabProps } from "./types";

// 画面右下に浮かせる主要アクション。HIG に FAB は無いため円形の prominent ボタンで表す。
export const Fab = ({ title, onPress }: FabProps) => (
  <Host matchContents>
    <Button
      onPress={onPress}
      modifiers={[
        buttonStyle("borderedProminent"),
        buttonBorderShape("circle"),
        controlSize("large"),
        accessibilityLabel(title),
      ]}
    >
      <Image
        systemName="plus"
        size={22}
        color="white"
        modifiers={[padding({ horizontal: 4, vertical: 4 })]}
      />
    </Button>
  </Host>
);
