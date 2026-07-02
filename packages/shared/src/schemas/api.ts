import { z } from "zod";

import { epochMsSchema } from "./common.ts";
import { disclosedLocationSchema } from "./location.ts";
import { membershipSchema } from "./membership.ts";
import { sessionSchema } from "./session.ts";

// API リクエスト/レスポンスのスキーマ。api と mobile が z.infer で型を導出する。

export const joinSessionInputSchema = z.object({
  inviteCode: z.string().min(1),
  displayName: z.string().min(1).max(50),
});
export type JoinSessionInput = z.infer<typeof joinSessionInputSchema>;

export const sessionDetailResponseSchema = z.object({
  session: sessionSchema,
  members: z.array(membershipSchema),
});
export type SessionDetailResponse = z.infer<typeof sessionDetailResponseSchema>;

// 開示ビュー。disclosure 以降の点は返さないが self は常に返す。
export const mapResponseSchema = z.object({
  disclosedAt: epochMsSchema.nullable(),
  nextDisclosureAt: epochMsSchema.nullable(),
  locations: z.array(disclosedLocationSchema),
  self: disclosedLocationSchema.nullable(),
});
export type MapResponse = z.infer<typeof mapResponseSchema>;

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
