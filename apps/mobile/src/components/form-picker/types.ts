export type FormPickerProps = {
  label: string;
  options: { label: string; value: number }[];
  selected: number;
  onSelect: (value: number) => void;
};
