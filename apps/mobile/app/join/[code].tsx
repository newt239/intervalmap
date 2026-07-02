import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

// 招待リンクの受け口。参加フロー本体は M3 で実装する。
export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>セッションに参加</Text>
      <Text style={styles.code}>招待コード: {code}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  code: {
    color: "#555",
    fontSize: 14,
  },
  container: {
    alignItems: "center",
    flex: 1,
    gap: 8,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
});
