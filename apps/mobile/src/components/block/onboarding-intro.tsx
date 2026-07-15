import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { ActionButton } from "#/components/ui/action-button";
import { ScreenTitle } from "#/components/ui/screen-title";
import { useTheme } from "#/components/ui/theme";

export const OnboardingIntro = () => {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safeArea, { backgroundColor: theme.groupedBackground }]}
    >
      <ScreenTitle title="intervalmap" />
      <View style={styles.body}>
        <Text style={[styles.description, { color: theme.label }]}>
          位置情報は設定したインターバルごとにメンバーへ開示されます
        </Text>
        <Text style={[styles.description, { color: theme.label }]}>
          共有はセッションの期限で自動的に終了します
        </Text>
        <Text style={[styles.description, { color: theme.secondaryLabel }]}>
          はじめに表示名を設定してください
        </Text>
      </View>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <ActionButton
          title="はじめる"
          onPress={() => {
            router.replace("/onboarding/display-name");
          }}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 16,
  },
  safeArea: {
    flex: 1,
  },
});
