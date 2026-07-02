import { z } from "zod";

import { MAX_LOCATION_BATCH_SIZE } from "../constants.ts";
import { epochMsSchema, latSchema, lngSchema } from "./common.ts";

// 位置情報のスキーマ。取得は連続、開示はサーバーが間欠制御する。

// クライアントが計測した1点。
export const locationPointInputSchema = z.object({
  capturedAt: epochMsSchema,
  lat: latSchema,
  lng: lngSchema,
  accuracyM: z.number().nonnegative().nullable().default(null),
  battery: z.number().min(0).max(1).nullable().default(null),
});
export type LocationPointInput = z.infer<typeof locationPointInputSchema>;

// 位置バッチアップロードリクエスト。
export const uploadLocationsInputSchema = z.object({
  points: z.array(locationPointInputSchema).min(1).max(MAX_LOCATION_BATCH_SIZE),
});
export type UploadLocationsInput = z.infer<typeof uploadLocationsInputSchema>;

// 開示ビューで返す、あるメンバーの最新位置。
export const disclosedLocationSchema = z.object({
  membershipId: z.string(),
  displayName: z.string(),
  lat: latSchema,
  lng: lngSchema,
  accuracyM: z.number().nonnegative().nullable(),
  capturedAt: epochMsSchema,
});
export type DisclosedLocation = z.infer<typeof disclosedLocationSchema>;
