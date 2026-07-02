import { Section, Text } from "@expo/ui/swift-ui";

import type { FormSectionProps } from "./types";

// Form 内のグループ。footer は HIG の説明文スタイルで表示される。
export const FormSection = ({ title, footer, children }: FormSectionProps) => (
  <Section title={title} footer={footer ? <Text>{footer}</Text> : undefined}>
    {children}
  </Section>
);
