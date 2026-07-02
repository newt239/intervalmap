import { useColorScheme } from "react-native";

import { Column, Text } from "@expo/ui/jetpack-compose";
import { padding } from "@expo/ui/jetpack-compose/modifiers";

import type { FormSectionProps } from "./types";

// Material 3 の設定画面に倣い、primary 色の小見出しでセクションを区切る。
export const FormSection = ({ title, footer, children }: FormSectionProps) => {
  const dark = useColorScheme() === "dark";
  return (
    <Column verticalArrangement={{ spacedBy: 12 }} modifiers={[padding(0, 12, 0, 12)]}>
      {title ? (
        <Text style={{ typography: "titleSmall" }} color={dark ? "#adc6ff" : "#2563eb"}>
          {title}
        </Text>
      ) : null}
      {children}
      {footer ? (
        <Text style={{ typography: "bodySmall" }} color={dark ? "#c4c6d0" : "#44464f"}>
          {footer}
        </Text>
      ) : null}
    </Column>
  );
};
