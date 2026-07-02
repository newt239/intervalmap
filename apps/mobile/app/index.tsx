import { StyleSheet, Text, View } from "react-native";

import { locationTracker } from "#/features/location";

// 起動確認用のプレースホルダ画面。本 UI は M3 以降で実装する。
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>intervalmap</Text>
      <Text style={styles.subtitle}>位置情報インターバル共有アプリ（M0 scaffold）</Text>
      <Text style={styles.status}>tracker: {locationTracker.getStatus()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    gap: 8,
    justifyContent: "center",
    padding: 24,
  },
  status: {
    color: "#888",
    fontSize: 12,
  },
  subtitle: {
    color: "#555",
    fontSize: 14,
    textAlign: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
});
