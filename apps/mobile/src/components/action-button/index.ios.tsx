import { StyleSheet } from "react-native";

import { Button, Host, Text } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  frame,
} from "@expo/ui/swift-ui/modifiers";

import type { ActionButtonProps } from "./types";

// RN レイアウト内に単独で置くボタン。HIG のボトムアクションに倣い全幅で表示する。
// ラベル側に frame を当てないと bordered 系スタイルの背景がラベル幅に縮むため children で渡す。
export const ActionButton = ({
  title,
  onPress,
  variant = "prominent",
  disabled,
}: ActionButtonProps) => (
  <Host matchContents={{ vertical: true }} style={styles.host}>
    <Button
      role={variant === "destructive" ? "destructive" : "default"}
      onPress={onPress}
      modifiers={[
        buttonStyle(variant === "bordered" ? "bordered" : "borderedProminent"),
        controlSize("large"),
        ...(disabled ? [disabledModifier(true)] : []),
      ]}
    >
      <Text modifiers={[frame({ maxWidth: 10_000 })]}>{title}</Text>
    </Button>
  </Host>
);

const styles = StyleSheet.create({
  host: {
    width: "100%",
  },
});
