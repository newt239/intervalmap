import { ListItem, Text } from "@expo/ui/jetpack-compose";
import { clickable } from "@expo/ui/jetpack-compose/modifiers";

import type { FormLinkProps } from "./types";

// 詳細ページへ遷移する行。Material の慣例に従い trailing の矢印は付けない。
export const FormLink = ({ label, onPress }: FormLinkProps) => (
  <ListItem
    modifiers={[
      clickable(() => {
        onPress();
      }),
    ]}
  >
    <ListItem.HeadlineContent>
      <Text>{label}</Text>
    </ListItem.HeadlineContent>
  </ListItem>
);
