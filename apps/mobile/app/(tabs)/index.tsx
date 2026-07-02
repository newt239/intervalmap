import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { ensureRegistered, loadAuth } from "#/features/auth/auth-store";
import { apiFetch } from "#/lib/api-client";
import { sessionWithMembershipResponseSchema } from "@intervalmap/shared";

// 開示インターバルとセッション有効期間のプリセット。
const INTERVAL_OPTIONS = [
  { label: "30秒", value: 30 },
  { label: "1分", value: 60 },
  { label: "5分", value: 300 },
  { label: "15分", value: 900 },
  { label: "1時間", value: 3600 },
];

const DURATION_OPTIONS = [
  { label: "30分", value: 1800 },
  { label: "1時間", value: 3600 },
  { label: "3時間", value: 10800 },
  { label: "24時間", value: 86400 },
];

type OptionRowProps = {
  options: { label: string; value: number }[];
  selected: number;
  onSelect: (value: number) => void;
};

const OptionRow = ({ options, selected, onSelect }: OptionRowProps) => (
  <View style={styles.optionRow}>
    {options.map((opt) => (
      <Pressable
        key={opt.value}
        style={[styles.option, selected === opt.value && styles.optionSelected]}
        onPress={() => onSelect(opt.value)}
      >
        <Text style={selected === opt.value ? styles.optionTextSelected : styles.optionText}>
          {opt.label}
        </Text>
      </Pressable>
    ))}
  </View>
);

// ホーム画面。セッションの新規作成と招待コードでの参加。
export default function HomeScreen() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [registered, setRegistered] = useState(false);
  const [title, setTitle] = useState("");
  const [intervalSec, setIntervalSec] = useState(300);
  const [durationSec, setDurationSec] = useState(3600);
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadAuth().then((auth) => {
      if (auth) {
        setDisplayName(auth.displayName);
        setRegistered(true);
      }
    });
  }, []);

  const requireDisplayName = (): string | null => {
    const name = displayName.trim();
    if (!name) {
      Alert.alert("入力エラー", "表示名を入力してください");
      return null;
    }
    return name;
  };

  const onCreate = async () => {
    const name = requireDisplayName();
    if (!name) {
      return;
    }
    if (!title.trim()) {
      Alert.alert("入力エラー", "セッション名を入力してください");
      return;
    }
    setBusy(true);
    try {
      const auth = await ensureRegistered(name);
      const res = await apiFetch(sessionWithMembershipResponseSchema, "/sessions", {
        method: "POST",
        token: auth.token,
        body: JSON.stringify({ title: title.trim(), intervalSec, durationSec }),
      });
      router.push(`/session/${res.session.id}`);
    } catch (error) {
      Alert.alert("作成に失敗しました", error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const onJoin = async () => {
    const name = requireDisplayName();
    if (!name) {
      return;
    }
    const code = inviteCode.trim();
    if (!code) {
      Alert.alert("入力エラー", "招待コードを入力してください");
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
      router.push(`/session/${res.session.id}`);
    } catch (error) {
      Alert.alert("参加に失敗しました", error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.screenTitle}>intervalmap</Text>
        <Text style={styles.sectionTitle}>あなたの表示名</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="例: たろう"
          editable={!registered}
        />
        {registered ? <Text style={styles.note}>登録済みの表示名を使用します</Text> : null}

        <Text style={styles.sectionTitle}>セッションを作成</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="セッション名（例: 鬼ごっこ）"
        />
        <Text style={styles.label}>開示インターバル</Text>
        <OptionRow options={INTERVAL_OPTIONS} selected={intervalSec} onSelect={setIntervalSec} />
        <Text style={styles.label}>有効期間（期限で追跡は自動停止）</Text>
        <OptionRow options={DURATION_OPTIONS} selected={durationSec} onSelect={setDurationSec} />
        <Pressable style={styles.primaryButton} onPress={onCreate} disabled={busy}>
          <Text style={styles.primaryButtonText}>作成する</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>招待コードで参加</Text>
        <TextInput
          style={styles.input}
          value={inviteCode}
          onChangeText={setInviteCode}
          placeholder="招待コード"
          autoCapitalize="none"
        />
        <Pressable style={styles.secondaryButton} onPress={onJoin} disabled={busy}>
          <Text style={styles.secondaryButtonText}>参加する</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    padding: 20,
  },
  input: {
    borderColor: "#ccc",
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    padding: 12,
  },
  label: {
    color: "#555",
    fontSize: 13,
    marginTop: 4,
  },
  note: {
    color: "#888",
    fontSize: 12,
  },
  option: {
    borderColor: "#ccc",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  optionText: {
    color: "#333",
  },
  optionTextSelected: {
    color: "#fff",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 8,
    marginTop: 12,
    padding: 14,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  safeArea: {
    flex: 1,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "bold",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#2563eb",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 14,
  },
  secondaryButtonText: {
    color: "#2563eb",
    fontSize: 16,
    fontWeight: "bold",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 16,
  },
});
