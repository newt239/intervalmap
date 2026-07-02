export type FormTextFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
};
