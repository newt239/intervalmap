import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ensureRegistered, loadAuth } from "#/features/auth/auth-store";
import { apiFetch } from "#/lib/api-client";
import { sessionWithMembershipResponseSchema } from "@intervalmap/shared";

// 招待リンク https://<domain>/join/<code> とディープリンクの受け口。
export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadAuth().then((auth) => {
      if (auth) {
        setDisplayName(auth.displayName);
        setRegistered(true);
      }
    });
  }, []);

  const onJoin = async () => {
    const name = displayName.trim();
    if (!name) {
      Alert.alert("入力エラー", "表示名を入力してください");
      return;
    }
    if (!code) {
      Alert.alert("エラー", "招待コードがありません");
      return;
    }
    setBusy(true);
    try {
      const auth = await ensureRegistered(name);
      const res = await apiFetch(sessionWithMembershipResponseSchema, "/sessions/join", {
        method: "POST",
        token: auth.token,
        body: JSON.stringify({ inviteCode: code }),
      });
      router.replace(`/session/${res.session.id}`);
    } catch (error) {
      Alert.alert("参加に失敗しました", error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>セッションに参加</Text>
      <Text style={styles.code}>招待コード: {code}</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="あなたの表示名"
        editable={!registered}
      />
      <Pressable style={styles.button} onPress={onJoin} disabled={busy}>
        <Text style={styles.buttonText}>参加する</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 8,
    marginTop: 8,
    padding: 14,
    width: "100%",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  code: {
    color: "#555",
    fontSize: 14,
  },
  container: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 24,
  },
  input: {
    borderColor: "#ccc",
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    padding: 12,
    width: "100%",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
});
