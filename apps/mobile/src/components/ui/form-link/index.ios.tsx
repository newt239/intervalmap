import { PlatformColor } from "react-native";

import { HStack, Image, Spacer, Text } from "@expo/ui/swift-ui";
import { onTapGesture } from "@expo/ui/swift-ui/modifiers";

import type { FormLinkProps } from "./types";

// Form 内の詳細ページへ遷移する行。iOS 設定アプリの NavigationLink 風に chevron を添える。
export const FormLink = ({ label, onPress }: FormLinkProps) => (
  <HStack
    spacing={8}
    modifiers={[
      onTapGesture(() => {
        onPress();
      }),
    ]}
  >
    <Text>{label}</Text>
    <Spacer />
    <Image systemName="chevron.right" size={13} color={PlatformColor("tertiaryLabel")} />
  </HStack>
);
