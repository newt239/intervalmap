import { PlatformColor } from "react-native";

import type { Theme } from "./types";

// iOS はシステムカラーを参照し、ダークモード対応を OS の動的解決に任せる。
const theme: Theme = {
  background: PlatformColor("systemBackground"),
  groupedBackground: PlatformColor("systemGroupedBackground"),
  label: PlatformColor("label"),
  secondaryLabel: PlatformColor("secondaryLabel"),
  tint: PlatformColor("systemBlue"),
  destructive: PlatformColor("systemRed"),
};

export const useTheme = (): Theme => theme;
