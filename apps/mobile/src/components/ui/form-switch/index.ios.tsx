import { Toggle } from "@expo/ui/swift-ui";
import { disabled as disabledModifier } from "@expo/ui/swift-ui/modifiers";

import type { FormSwitchProps } from "./types";

// Form の行として置くトグル。iOS 設定アプリと同じくラベル右側のスイッチで切り替える。
export const FormSwitch = ({ label, value, onValueChange, disabled }: FormSwitchProps) => (
  <Toggle
    label={label}
    isOn={value}
    onIsOnChange={onValueChange}
    modifiers={disabled ? [disabledModifier(true)] : []}
  />
);
