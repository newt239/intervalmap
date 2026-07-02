import { useColorScheme } from "react-native";

import { Row, Spacer, Text } from "@expo/ui/jetpack-compose";
import { fillMaxWidth, weight } from "@expo/ui/jetpack-compose/modifiers";

import type { FormLabelValueProps } from "./types";

const TONE_COLORS = {
  light: { default: "#1b1b1f", success: "#146c2e", muted: "#44464f" },
  dark: { default: "#e4e2e6", success: "#6dd58c", muted: "#c4c6d0" },
} as const;

// ラベルと値を左右に並べる行。権限の状態表示などに使う。
export const FormLabelValue = ({ label, value, tone = "default" }: FormLabelValueProps) => {
  const colors = TONE_COLORS[useColorScheme() === "dark" ? "dark" : "light"];
  return (
    <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
      <Text style={{ typography: "bodyLarge" }} color={colors.default}>
        {label}
      </Text>
      <Spacer modifiers={[weight(1)]} />
      <Text style={{ typography: "bodyMedium" }} color={colors[tone]}>
        {value}
      </Text>
    </Row>
  );
};
