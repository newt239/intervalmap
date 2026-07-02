import { z } from "zod";

import { epochMsSchema, sessionStatusSchema } from "./common.ts";
import { disclosedLocationSchema, historyTrackSchema } from "./location.ts";
import { membershipSchema } from "./membership.ts";
import { sessionSchema } from "./session.ts";
import { userSchema } from "./user.ts";

// API リクエスト/レスポンスのスキーマ。api と mobile が z.infer で型を導出する。

// 匿名デバイス認証のレスポンス。token は端末の SecureStore にのみ保存する。
export const authResponseSchema = z.object({
  user: userSchema,
  token: z.string(),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const joinSessionInputSchema = z.object({
  inviteCode: z.string().min(1),
});
export type JoinSessionInput = z.infer<typeof joinSessionInputSchema>;

// セッション作成・参加のレスポンス。自分の membership を伴う。
export const sessionWithMembershipResponseSchema = z.object({
  session: sessionSchema,
  membership: membershipSchema,
});
export type SessionWithMembershipResponse = z.infer<typeof sessionWithMembershipResponseSchema>;

export const sessionListResponseSchema = z.object({
  serverNow: epochMsSchema,
  sessions: z.array(
    z.object({
      session: sessionSchema,
      membership: membershipSchema,
    }),
  ),
});
export type SessionListResponse = z.infer<typeof sessionListResponseSchema>;

export const sessionDetailResponseSchema = z.object({
  session: sessionSchema,
  members: z.array(membershipSchema),
});
export type SessionDetailResponse = z.infer<typeof sessionDetailResponseSchema>;

// 位置バッチアップロードのレスポンス。status を返しクライアントの自走停止と二重化する。
export const uploadLocationsResponseSchema = z.object({
  accepted: z.number().int().nonnegative(),
  sessionStatus: sessionStatusSchema,
});
export type UploadLocationsResponse = z.infer<typeof uploadLocationsResponseSchema>;

// 開示ビュー。disclosure 以降の点は返さないが self は常に返す。
// serverNow を返しカウントダウンを端末時計に依存させない。
export const mapResponseSchema = z.object({
  serverNow: epochMsSchema,
  disclosedAt: epochMsSchema.nullable(),
  nextDisclosureAt: epochMsSchema.nullable(),
  sessionStatus: sessionStatusSchema,
  locations: z.array(disclosedLocationSchema),
  self: disclosedLocationSchema.nullable(),
});
export type MapResponse = z.infer<typeof mapResponseSchema>;

export const historyResponseSchema = z.object({
  serverNow: epochMsSchema,
  sessionStatus: sessionStatusSchema,
  tracks: z.array(historyTrackSchema),
});
export type HistoryResponse = z.infer<typeof historyResponseSchema>;

export const registerPushTokenInputSchema = z.object({
  expoPushToken: z.string().min(1),
  platform: z.enum(["ios", "android"]),
});
export type RegisterPushTokenInput = z.infer<typeof registerPushTokenInputSchema>;

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
