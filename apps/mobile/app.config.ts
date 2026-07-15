import type { ExpoConfig } from "expo/config";

// Expo アプリ設定。Expo Go 不可で expo-dev-client + EAS Build 前提。
// ネイティブ設定を変更したら EAS 再ビルドが必要。
const config: ExpoConfig = {
  name: "intervalmap",
  slug: "intervalmap",
  scheme: "intervalmap",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "dev.newt239.intervalmap",
    infoPlist: {
      UIBackgroundModes: ["location"],
    },
    // 招待リンクのユニバーサルリンク。AASA は API Worker が配信する。
    associatedDomains: ["applinks:intervalmap.newt239.dev"],
  },
  android: {
    package: "dev.newt239.intervalmap",
    // 招待リンクの App Links。assetlinks.json は API Worker が配信する。
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: "intervalmap.newt239.dev", pathPrefix: "/join" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  plugins: [
    "expo-router",
    "expo-dev-client",
    [
      "expo-location",
      {
        // iOS は When In Use から Always への2段階昇格。purpose string に有限性を明記。
        locationWhenInUsePermission:
          "参加中のセッションの間だけ、設定した間隔で位置を共有するために使用します。",
        locationAlwaysAndWhenInUsePermission:
          "参加中のセッションの間だけ、設定した間隔で位置を共有するために使用します。セッションの期限が来ると追跡は自動的に停止します。",
        isAndroidForegroundServiceEnabled: true,
        // 背景位置情報審査の回避を狙い当面は false で検証する。M1 で確定。
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    "expo-task-manager",
    "expo-notifications",
    "expo-maps",
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    // EAS プロジェクト ID は eas init 時に自動注入される。
    eas: {},
  },
};

export default config;
