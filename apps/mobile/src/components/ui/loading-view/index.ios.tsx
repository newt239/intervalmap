import { StyleSheet, View } from "react-native";

import { Host, ProgressView } from "@expo/ui/swift-ui";

import { useTheme } from "../theme";

// 画面全体の読み込み中表示。
export const LoadingView = () => {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Host matchContents>
        <ProgressView />
      </Host>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
});
