import { StyleSheet, Text } from "react-native";

import { useTheme } from "../theme";

import type { ScreenTitleProps } from "./types";

// Material 3 のトップアプリバー相当のタイトル。
export const ScreenTitle = ({ title }: ScreenTitleProps) => {
  const theme = useTheme();
  return <Text style={[styles.title, { color: theme.label }]}>{title}</Text>;
};

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: "500",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
