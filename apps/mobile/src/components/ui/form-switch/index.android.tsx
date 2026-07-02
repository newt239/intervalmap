import { useColorScheme } from "react-native";

import { Row, Spacer, Switch, Text } from "@expo/ui/jetpack-compose";
import { fillMaxWidth, weight } from "@expo/ui/jetpack-compose/modifiers";

import type { FormSwitchProps } from "./types";

// Material 3 のスイッチ行。ラベルとスイッチを左右に並べる。
export const FormSwitch = ({ label, value, onValueChange }: FormSwitchProps) => {
  const dark = useColorScheme() === "dark";
  return (
    <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
      <Text style={{ typography: "bodyLarge" }} color={dark ? "#e4e2e6" : "#1b1b1f"}>
        {label}
      </Text>
      <Spacer modifiers={[weight(1)]} />
      <Switch value={value} onCheckedChange={onValueChange} />
    </Row>
  );
};
