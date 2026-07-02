export type ScreenListItem = {
  id: string;
  title: string;
  subtitle: string;
  status?: { label: string; tone: "active" | "muted" };
};

export type ScreenListProps = {
  items: ScreenListItem[];
  onPressItem: (id: string) => void;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  emptyTitle: string;
  emptyDescription?: string;
};
