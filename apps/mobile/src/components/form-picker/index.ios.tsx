import { Picker, Text } from "@expo/ui/swift-ui";
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";

import type { FormPickerProps } from "./types";

// Form の行として置く選択。iOS 設定アプリと同じくラベル右側のメニューで選ぶ。
export const FormPicker = ({ label, options, selected, onSelect }: FormPickerProps) => (
  <Picker<number>
    label={label}
    selection={selected}
    onSelectionChange={onSelect}
    modifiers={[pickerStyle("menu")]}
  >
    {options.map((option) => (
      <Text key={option.value} modifiers={[tag(option.value)]}>
        {option.label}
      </Text>
    ))}
  </Picker>
);
