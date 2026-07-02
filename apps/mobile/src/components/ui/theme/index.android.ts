import { useColorScheme } from "react-native";

import type { Theme } from "./types";

// Material 3 ベースラインのパレット。primary はブランドの #2563eb に寄せる。
const light: Theme = {
  background: "#fdfbff",
  groupedBackground: "#fdfbff",
  label: "#1b1b1f",
  secondaryLabel: "#44464f",
  tint: "#2563eb",
  destructive: "#ba1a1a",
};

const dark: Theme = {
  background: "#1b1b1f",
  groupedBackground: "#1b1b1f",
  label: "#e4e2e6",
  secondaryLabel: "#c4c6d0",
  tint: "#adc6ff",
  destructive: "#ffb4ab",
};

export const useTheme = (): Theme => (useColorScheme() === "dark" ? dark : light);
