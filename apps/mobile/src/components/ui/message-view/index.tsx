import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme";

type MessageViewProps = {
  message: string;
};

// エラーや未登録などの案内文を中央に表示する。OS 差が無いため単一実装。
export const MessageView = ({ message }: MessageViewProps) => {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.message, { color: theme.secondaryLabel }]}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  message: {
    fontSize: 14,
    textAlign: "center",
  },
});
