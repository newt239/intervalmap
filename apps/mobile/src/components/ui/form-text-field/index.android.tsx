import { useEffect, useRef } from "react";

import { OutlinedTextField, Text, useNativeState } from "@expo/ui/jetpack-compose";
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";

import type { FormTextFieldProps } from "./types";

// Material 3 の OutlinedTextField。ラベルはフローティングラベルとして表示する。
export const FormTextField = ({
  value,
  onChangeText,
  label,
  placeholder,
  disabled,
}: FormTextFieldProps) => {
  const text = useNativeState(value);
  // ネイティブ側が知っている最新値。外部からの更新だけを set に流し echo ループを防ぐ。
  const lastNativeText = useRef(value);

  useEffect(() => {
    if (value !== lastNativeText.current) {
      lastNativeText.current = value;
      text.set(value);
    }
  }, [value, text]);

  return (
    <OutlinedTextField
      value={text}
      enabled={!disabled}
      singleLine
      onValueChange={(next) => {
        lastNativeText.current = next;
        onChangeText(next);
      }}
      modifiers={[fillMaxWidth()]}
    >
      <OutlinedTextField.Label>
        <Text>{label}</Text>
      </OutlinedTextField.Label>
      {placeholder ? (
        <OutlinedTextField.Placeholder>
          <Text>{placeholder}</Text>
        </OutlinedTextField.Placeholder>
      ) : null}
    </OutlinedTextField>
  );
};
