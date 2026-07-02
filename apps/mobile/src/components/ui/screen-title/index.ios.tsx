import { StyleSheet, Text } from "react-native";

import { useTheme } from "../theme";

import type { ScreenTitleProps } from "./types";

// HIG の Large Title 相当。
export const ScreenTitle = ({ title }: ScreenTitleProps) => {
  const theme = useTheme();
  return <Text style={[styles.title, { color: theme.label }]}>{title}</Text>;
};

const styles = StyleSheet.create({
  title: {
    fontSize: 34,
    fontWeight: "bold",
    paddingHorizontal: 16,
    paddingTop: 4,
  },
});
