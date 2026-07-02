import { StyleSheet, View } from "react-native";

import { CircularProgressIndicator, Host } from "@expo/ui/jetpack-compose";

import { useTheme } from "../theme";

// 画面全体の読み込み中表示。
export const LoadingView = () => {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Host matchContents>
        <CircularProgressIndicator />
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
