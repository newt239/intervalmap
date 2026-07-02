import { useEffect, useRef } from "react";

import { TextField, useNativeState } from "@expo/ui/swift-ui";
import { disabled as disabledModifier } from "@expo/ui/swift-ui/modifiers";

import type { FormTextFieldProps } from "./types";

// Form の行として置くテキスト入力。ラベルは HIG に倣い placeholder で代替する。
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
    <TextField
      text={text}
      placeholder={placeholder ?? label}
      onTextChange={(next) => {
        lastNativeText.current = next;
        onChangeText(next);
      }}
      modifiers={disabled ? [disabledModifier(true)] : undefined}
    />
  );
};
