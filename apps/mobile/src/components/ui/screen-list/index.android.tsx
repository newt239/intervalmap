import { StyleSheet, useColorScheme } from "react-native";

import { Host, LazyColumn, ListItem, PullToRefreshBox, Text } from "@expo/ui/jetpack-compose";
import { clickable, fillMaxSize } from "@expo/ui/jetpack-compose/modifiers";

import type { ScreenListProps } from "./types";

const STATUS_COLORS = {
  light: { active: "#146c2e", muted: "#44464f" },
  dark: { active: "#6dd58c", muted: "#c4c6d0" },
} as const;

// Material 3 のリスト。行タップで遷移し、引っ張って更新できる。
export const ScreenList = ({
  items,
  onPressItem,
  refreshing,
  onRefresh,
  emptyTitle,
  emptyDescription,
}: ScreenListProps) => {
  const colors = STATUS_COLORS[useColorScheme() === "dark" ? "dark" : "light"];
  if (items.length === 0) {
    return (
      <Host style={styles.host}>
        <LazyColumn
          horizontalAlignment="center"
          contentPadding={{ start: 24, end: 24, top: 48 }}
          verticalArrangement={{ spacedBy: 8 }}
        >
          <Text style={{ typography: "titleMedium" }}>{emptyTitle}</Text>
          {emptyDescription ? (
            <Text style={{ typography: "bodyMedium" }} color={colors.muted}>
              {emptyDescription}
            </Text>
          ) : null}
        </LazyColumn>
      </Host>
    );
  }
  return (
    <Host style={styles.host}>
      <PullToRefreshBox
        isRefreshing={refreshing}
        onRefresh={() => {
          onRefresh().catch(() => {});
        }}
        modifiers={[fillMaxSize()]}
      >
        <LazyColumn modifiers={[fillMaxSize()]}>
          {items.map((item) => (
            <ListItem
              key={item.id}
              modifiers={[
                clickable(() => {
                  onPressItem(item.id);
                }),
              ]}
            >
              <ListItem.HeadlineContent>
                <Text>{item.title}</Text>
              </ListItem.HeadlineContent>
              <ListItem.SupportingContent>
                <Text style={{ typography: "bodyMedium" }} color={colors.muted}>
                  {item.subtitle}
                </Text>
              </ListItem.SupportingContent>
              {item.status ? (
                <ListItem.TrailingContent>
                  <Text style={{ typography: "labelMedium" }} color={colors[item.status.tone]}>
                    {item.status.label}
                  </Text>
                </ListItem.TrailingContent>
              ) : null}
            </ListItem>
          ))}
        </LazyColumn>
      </PullToRefreshBox>
    </Host>
  );
};

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
});
