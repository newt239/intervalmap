import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";

import { FormButton } from "#/components/form-button";
import { FormScreen } from "#/components/form-screen";
import { FormSection } from "#/components/form-section";
import { FormTextField } from "#/components/form-text-field";
import { loadAuth, updateDisplayName } from "#/features/auth/auth-store";

// 表示名の登録と変更。
export default function DisplayNameScreen() {
  const [displayName, setDisplayName] = useState("");
  const [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadAuth().then((auth) => {
        if (auth) {
          setDisplayName(auth.displayName);
          setRegistered(true);
        }
      });
    }, []),
  );

  const onSave = async () => {
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

  return (
    <FormScreen insetTop={false}>
      <FormSection footer="セッションで他のメンバーに表示される名前です">
        <FormTextField
          label="表示名"
          placeholder="例: たろう"
          value={displayName}
          onChangeText={setDisplayName}
        />
      </FormSection>
      <FormButton title={registered ? "変更を保存" : "登録する"} onPress={onSave} disabled={busy} />
    </FormScreen>
  );
}
