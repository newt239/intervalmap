import { Button, Text } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  frame,
  listRowBackground,
  listRowInsets,
  listRowSeparator,
  padding,
} from "@expo/ui/swift-ui/modifiers";

import type { FormButtonProps } from "./types";

// Form 直下に置くアクションボタン。行の背景を消し、HIG のフォーム下の全幅ボタンとして表示する。
// ラベル側に frame を当てないと bordered 系スタイルの背景がラベル幅に縮むため children で渡す。
export const FormButton = ({ title, onPress, variant = "primary", disabled }: FormButtonProps) => (
  <Button
    onPress={onPress}
    modifiers={[
      buttonStyle(variant === "primary" ? "borderedProminent" : "bordered"),
      controlSize("large"),
      padding({ vertical: 4 }),
      listRowBackground("transparent"),
      listRowInsets({ top: 0, leading: 0, bottom: 0, trailing: 0 }),
      listRowSeparator("hidden", "all"),
      ...(disabled ? [disabledModifier(true)] : []),
    ]}
  >
    <Text modifiers={[frame({ maxWidth: 10_000 })]}>{title}</Text>
  </Button>
);
