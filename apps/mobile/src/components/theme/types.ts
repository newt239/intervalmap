import type { ColorValue } from "react-native";

// index.ios.ts と index.android.ts が実装する共有トークン型。
export type Theme = {
  background: ColorValue;
  groupedBackground: ColorValue;
  label: ColorValue;
  secondaryLabel: ColorValue;
  tint: ColorValue;
  destructive: ColorValue;
};
