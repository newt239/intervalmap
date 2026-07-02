import { AppleMaps, GoogleMaps } from "expo-maps";
import { Platform, StyleSheet } from "react-native";

import type { DisclosedLocation } from "@intervalmap/shared";

type Props = {
  locations: DisclosedLocation[];
  self: DisclosedLocation | null;
  selfMembershipId: string | null;
};

// 開示済みメンバー位置と自分の現在位置を表示する。iOS: Apple Maps / Android: Google Maps。
// locations は最新開示時点の位置のみで、self だけが常に現在位置になる。
export const SessionMap = ({ locations, self, selfMembershipId }: Props) => {
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
  const center = self ?? others[0] ?? null;
  const cameraPosition = {
    coordinates: {
      latitude: center?.lat ?? 35.6812,
      longitude: center?.lng ?? 139.7671,
    },
    zoom: 14,
  };

  if (Platform.OS === "ios") {
    return <AppleMaps.View style={styles.map} cameraPosition={cameraPosition} markers={markers} />;
  }
  return <GoogleMaps.View style={styles.map} cameraPosition={cameraPosition} markers={markers} />;
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
