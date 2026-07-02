import { StyleSheet, useColorScheme } from "react-native";

import { Button, Host, OutlinedButton, Text } from "@expo/ui/jetpack-compose";
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";

import type { ActionButtonProps } from "./types";

const ERROR_COLORS = {
  light: { containerColor: "#ba1a1a", contentColor: "#ffffff" },
  dark: { containerColor: "#93000a", contentColor: "#ffdad6" },
} as const;

// RN レイアウト内に単独で置くボタン。Material 3 の Filled/Outlined を使い分ける。
export const ActionButton = ({
  title,
  onPress,
  variant = "prominent",
  disabled,
}: ActionButtonProps) => {
  const errorColors = ERROR_COLORS[useColorScheme() === "dark" ? "dark" : "light"];
  const Component = variant === "bordered" ? OutlinedButton : Button;
  return (
    <Host matchContents={{ vertical: true }} style={styles.host}>
      <Component
        onClick={onPress}
        enabled={!disabled}
        colors={variant === "destructive" ? errorColors : undefined}
        modifiers={[fillMaxWidth()]}
      >
        <Text>{title}</Text>
      </Component>
    </Host>
  );
};

const styles = StyleSheet.create({
  host: {
    width: "100%",
  },
});
