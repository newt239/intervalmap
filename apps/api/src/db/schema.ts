import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Drizzle スキーマ。M0 は最小定義で、時刻は epoch ミリ秒で保持する。

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  // 匿名デバイス認証のベアラートークン。機種変更時の引き継ぎ方式は未決。
  authToken: text("auth_token").notNull().unique(),
  createdAt: integer("created_at").notNull(),
});

export const pushTokens = sqliteTable("push_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expoPushToken: text("expo_push_token").notNull(),
  platform: text("platform", { enum: ["ios", "android"] }).notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  // セッションに1本の常設招待リンクのコード。再生成すると旧リンクは使えなくなる。
  inviteCode: text("invite_code").notNull().unique(),
  intervalSec: integer("interval_sec").notNull(),
  startsAt: integer("starts_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  precision: text("precision", { enum: ["exact", "coarse"] })
    .notNull()
    .default("exact"),
  status: text("status", { enum: ["scheduled", "active", "ended"] })
    .notNull()
    .default("scheduled"),
  nextDisclosureAt: integer("next_disclosure_at"),
  // 実際に終了した時刻。履歴の自動削除はこの時刻を基準に保持期間を数える。
  endedAt: integer("ended_at"),
  createdAt: integer("created_at").notNull(),
});

export const memberships = sqliteTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    // owner はセッション主催者。
    role: text("role", { enum: ["owner", "member"] })
      .notNull()
      .default("member"),
    lastUploadedAt: integer("last_uploaded_at"),
    joinedAt: integer("joined_at").notNull(),
    // 退出時刻。退出後は地図・履歴・アップロードの対象から外れる。
    leftAt: integer("left_at"),
  },
  (t) => [index("idx_memberships_session").on(t.sessionId)],
);

export const locationPoints = sqliteTable(
  "location_points",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    membershipId: text("membership_id")
      .notNull()
      .references(() => memberships.id),
    capturedAt: integer("captured_at").notNull(),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    accuracyM: real("accuracy_m"),
    battery: real("battery"),
    uploadedAt: integer("uploaded_at").notNull(),
  },
  // 開示クエリ用インデックス。
  (t) => [index("idx_location_session_captured").on(t.sessionId, t.capturedAt)],
);

export const disclosures = sqliteTable(
  "disclosures",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    disclosedAt: integer("disclosed_at").notNull(),
  },
  (t) => [index("idx_disclosures_session").on(t.sessionId)],
);

export const alerts = sqliteTable("alerts", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id),
  membershipId: text("membership_id").references(() => memberships.id),
  type: text("type", { enum: ["no_response", "session_end"] }).notNull(),
  firedAt: integer("fired_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type MembershipRow = typeof memberships.$inferSelect;
export type LocationPointRow = typeof locationPoints.$inferSelect;
export type DisclosureRow = typeof disclosures.$inferSelect;
