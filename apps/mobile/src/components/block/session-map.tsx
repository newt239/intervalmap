import { AppleMaps, GoogleMaps } from "expo-maps";
import { Platform, StyleSheet } from "react-native";

import type { DisclosedLocation, HistoryTrack } from "@intervalmap/shared";

type Props = {
  locations: DisclosedLocation[];
  self: DisclosedLocation | null;
  selfMembershipId: string | null;
  tracks: HistoryTrack[];
};

const TRACK_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2"];

// 開示済みメンバー位置と自分の現在位置を表示する。iOS: Apple Maps / Android: Google Maps。
// locations は最新開示時点の位置のみで、self だけが常に現在位置になる。
export const SessionMap = ({ locations, self, selfMembershipId, tracks }: Props) => {
  const others = locations.filter((l) => l.membershipId !== selfMembershipId);
  const markers = [
    ...others.map((l) => ({
      id: l.membershipId,
      coordinates: { latitude: l.lat, longitude: l.lng },
      title: l.displayName,
    })),
    ...(self
      ? [
          {
            id: "self",
            coordinates: { latitude: self.lat, longitude: self.lng },
            title: `${self.displayName}（自分・現在地）`,
          },
        ]
      : []),
  ];
  const polylines = tracks
    .filter((t) => t.points.length >= 2)
    .map((t, i) => ({
      id: t.membershipId,
      coordinates: t.points.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      color: TRACK_COLORS[i % TRACK_COLORS.length] ?? "#2563eb",
      width: 3,
    }));
  const center = self ?? others[0] ?? null;
  const cameraPosition = {
    coordinates: {
      latitude: center?.lat ?? 35.6812,
      longitude: center?.lng ?? 139.7671,
    },
    zoom: 14,
  };

  if (Platform.OS === "ios") {
    return (
      <AppleMaps.View
        style={styles.map}
        cameraPosition={cameraPosition}
        markers={markers}
        polylines={polylines}
      />
    );
  }
  return (
    <GoogleMaps.View
      style={styles.map}
      cameraPosition={cameraPosition}
      markers={markers}
      polylines={polylines}
    />
  );
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
