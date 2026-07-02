import { PlatformColor, StyleSheet } from "react-native";

import {
  ContentUnavailableView,
  Host,
  HStack,
  Image,
  List,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import { font, foregroundStyle, onTapGesture, refreshable } from "@expo/ui/swift-ui/modifiers";

import type { ScreenListProps } from "./types";

const STATUS_COLORS = {
  active: PlatformColor("systemGreen"),
  muted: PlatformColor("secondaryLabel"),
} as const;

// HIG の inset grouped リスト。行タップで遷移し、引っ張って更新できる。
export const ScreenList = ({
  items,
  onPressItem,
  onRefresh,
  emptyTitle,
  emptyDescription,
}: ScreenListProps) => {
  if (items.length === 0) {
    return (
      <Host style={styles.host} useViewportSizeMeasurement>
        <ContentUnavailableView
          title={emptyTitle}
          description={emptyDescription}
          systemImage="mappin.and.ellipse"
        />
      </Host>
    );
  }
  return (
    <Host style={styles.host} useViewportSizeMeasurement>
      <List modifiers={[refreshable(onRefresh)]}>
        {items.map((item) => (
          <HStack
            key={item.id}
            spacing={8}
            modifiers={[
              onTapGesture(() => {
                onPressItem(item.id);
              }),
            ]}
          >
            <VStack alignment="leading" spacing={2}>
              <Text>{item.title}</Text>
              <Text
                modifiers={[
                  font({ textStyle: "footnote" }),
                  foregroundStyle({ type: "hierarchical", style: "secondary" }),
                ]}
              >
                {item.subtitle}
              </Text>
            </VStack>
            <Spacer />
            {item.status ? (
              <Text
                modifiers={[
                  font({ textStyle: "footnote", weight: "semibold" }),
                  foregroundStyle(STATUS_COLORS[item.status.tone]),
                ]}
              >
                {item.status.label}
              </Text>
            ) : null}
            <Image systemName="chevron.right" size={13} color={PlatformColor("tertiaryLabel")} />
          </HStack>
        ))}
      </List>
    </Host>
  );
};

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
});
