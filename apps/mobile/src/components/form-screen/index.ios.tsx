import { StyleSheet } from "react-native";

import { Form, Host } from "@expo/ui/swift-ui";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenTitle } from "../screen-title";
import { useTheme } from "../theme";

import type { FormScreenProps } from "./types";

// HIG の inset grouped スタイルの設定フォーム。子には form-* コンポーネントのみ置ける。
export const FormScreen = ({ title, insetTop = true, children }: FormScreenProps) => {
  const theme = useTheme();
  return (
    <SafeAreaView
      edges={insetTop ? ["top"] : []}
      style={[styles.safeArea, { backgroundColor: theme.groupedBackground }]}
    >
      {title ? <ScreenTitle title={title} /> : null}
      <Host style={styles.host} useViewportSizeMeasurement>
        <Form>{children}</Form>
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
