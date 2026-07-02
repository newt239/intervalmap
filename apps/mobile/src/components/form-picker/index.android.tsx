import { useColorScheme } from "react-native";

import {
  Column,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Text,
} from "@expo/ui/jetpack-compose";

import type { FormPickerProps } from "./types";

// Material 3 のセグメンテッドボタンで択一する。選択肢は 5 個以下が前提。
export const FormPicker = ({ label, options, selected, onSelect }: FormPickerProps) => {
  const dark = useColorScheme() === "dark";
  return (
    <Column verticalArrangement={{ spacedBy: 8 }}>
      <Text style={{ typography: "labelLarge" }} color={dark ? "#c4c6d0" : "#44464f"}>
        {label}
      </Text>
      <SingleChoiceSegmentedButtonRow>
        {options.map((option) => (
          <SegmentedButton
            key={option.value}
            selected={selected === option.value}
            onClick={() => {
              onSelect(option.value);
            }}
          >
            <SegmentedButton.Label>
              <Text style={{ typography: "labelMedium" }}>{option.label}</Text>
            </SegmentedButton.Label>
          </SegmentedButton>
        ))}
      </SingleChoiceSegmentedButtonRow>
    </Column>
  );
};
