export type ActionButtonProps = {
  title: string;
  onPress: () => void;
  variant?: "prominent" | "bordered" | "destructive";
  disabled?: boolean;
};
