import { StyleSheet } from "react-native";

import { Host, LazyColumn } from "@expo/ui/jetpack-compose";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenTitle } from "../screen-title";
import { useTheme } from "../theme";

import type { FormScreenProps } from "./types";

// Material 3 の設定画面スタイル。子には form-* コンポーネントのみ置ける。
export const FormScreen = ({ title, insetTop = true, children }: FormScreenProps) => {
  const theme = useTheme();
  return (
    <SafeAreaView
      edges={insetTop ? ["top"] : []}
      style={[styles.safeArea, { backgroundColor: theme.background }]}
    >
      {title ? <ScreenTitle title={title} /> : null}
      <Host style={styles.host}>
        <LazyColumn contentPadding={{ start: 16, end: 16, top: 8, bottom: 24 }}>
          {children}
        </LazyColumn>
      </Host>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
});
