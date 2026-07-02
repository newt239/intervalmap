import { Button, FilledTonalButton, Text } from "@expo/ui/jetpack-compose";
import { fillMaxWidth, padding } from "@expo/ui/jetpack-compose/modifiers";

import type { FormButtonProps } from "./types";

// Material 3 のボタン。主要アクションは Filled、補助アクションは FilledTonal。
export const FormButton = ({ title, onPress, variant = "primary", disabled }: FormButtonProps) => {
  const Component = variant === "primary" ? Button : FilledTonalButton;
  return (
    <Component
      onClick={onPress}
      enabled={!disabled}
      modifiers={[padding(0, 4, 0, 4), fillMaxWidth()]}
    >
      <Text>{title}</Text>
    </Component>
  );
};
