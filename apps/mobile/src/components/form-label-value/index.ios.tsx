import { PlatformColor } from "react-native";

import { LabeledContent, Text } from "@expo/ui/swift-ui";
import { foregroundStyle } from "@expo/ui/swift-ui/modifiers";

import type { FormLabelValueProps } from "./types";

const TONE_COLORS = {
  default: PlatformColor("label"),
  success: PlatformColor("systemGreen"),
  muted: PlatformColor("secondaryLabel"),
} as const;

// Form の行としてラベルと値を並べる。iOS 設定アプリの詳細行と同じ見た目。
export const FormLabelValue = ({ label, value, tone = "default" }: FormLabelValueProps) => (
  <LabeledContent label={label}>
    <Text modifiers={[foregroundStyle(TONE_COLORS[tone])]}>{value}</Text>
  </LabeledContent>
);
