import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { loadAuth, updateDisplayName } from "#/features/auth/auth-store";

const PERMISSION_LABELS: Record<Location.PermissionStatus, string> = {
  granted: "許可済み",
  denied: "拒否",
  undetermined: "未設定",
};

type PermissionRowProps = {
  label: string;
  status: Location.PermissionStatus | null;
};

const PermissionRow = ({ label, status }: PermissionRowProps) => (
  <View style={styles.permissionRow}>
    <Text style={styles.permissionLabel}>{label}</Text>
    <Text
      style={[
        styles.permissionStatus,
        status === "granted" ? styles.permissionGranted : styles.permissionNotGranted,
      ]}
    >
      {status ? PERMISSION_LABELS[status] : "確認中"}
    </Text>
  </View>
);

// 設定画面。表示名の変更と位置情報権限の確認。
export default function SettingsScreen() {
  const [displayName, setDisplayName] = useState("");
  const [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [foreground, setForeground] = useState<Location.PermissionStatus | null>(null);
  const [background, setBackground] = useState<Location.PermissionStatus | null>(null);

  const refresh = useCallback(async () => {
    const auth = await loadAuth();
    if (auth) {
      setDisplayName(auth.displayName);
      setRegistered(true);
    }
    const fg = await Location.getForegroundPermissionsAsync();
    setForeground(fg.status);
    const bg = await Location.getBackgroundPermissionsAsync();
    setBackground(bg.status);
  }, []);

  // 設定アプリから戻ったときも最新の権限状態を映す。
  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, [refresh]),
  );

  const onSaveDisplayName = async () => {
    const name = displayName.trim();
    if (!name) {
      Alert.alert("入力エラー", "表示名を入力してください");
      return;
    }
    setBusy(true);
    try {
      const auth = await updateDisplayName(name);
      setDisplayName(auth.displayName);
      setRegistered(true);
      Alert.alert("保存しました", `表示名を「${auth.displayName}」にしました`);
    } catch (error) {
      Alert.alert("保存に失敗しました", error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const onRequestPermission = async () => {
    const fg = await Location.requestForegroundPermissionsAsync();
    setForeground(fg.status);
    if (!fg.granted && !fg.canAskAgain) {
      // OS のダイアログを出せない状態では設定アプリへ誘導する。
      Alert.alert("権限が拒否されています", "設定アプリから位置情報を許可してください", [
        { text: "キャンセル", style: "cancel" },
        { text: "設定を開く", onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    const bg = await Location.getBackgroundPermissionsAsync();
    setBackground(bg.status);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.screenTitle}>設定</Text>

        <Text style={styles.sectionTitle}>表示名</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="例: たろう"
        />
        <Pressable style={styles.primaryButton} onPress={onSaveDisplayName} disabled={busy}>
          <Text style={styles.primaryButtonText}>{registered ? "変更を保存" : "登録する"}</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>位置情報の権限</Text>
        <View style={styles.permissionCard}>
          <PermissionRow label="使用中の位置情報" status={foreground} />
          <PermissionRow label="常に許可" status={background} />
        </View>
        <Text style={styles.note}>
          セッション参加中はアプリを閉じても共有を続けるため「常に許可」を推奨します
        </Text>
        <Pressable style={styles.secondaryButton} onPress={onRequestPermission}>
          <Text style={styles.secondaryButtonText}>権限を確認・リクエスト</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => Linking.openSettings()}>
          <Text style={styles.secondaryButtonText}>設定アプリを開く</Text>
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
  note: {
    color: "#888",
    fontSize: 12,
  },
  permissionCard: {
    borderColor: "#ddd",
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  permissionGranted: {
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
  permissionLabel: {
    fontSize: 15,
  },
  permissionNotGranted: {
    backgroundColor: "#f3f4f6",
    color: "#555",
  },
  permissionRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  permissionStatus: {
    borderRadius: 8,
    fontSize: 12,
    fontWeight: "bold",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 8,
    marginTop: 4,
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
    marginTop: 4,
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
