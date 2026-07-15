import { z } from "zod";

import {
  MAX_INTERVAL_SEC,
  MAX_SESSION_DURATION_SEC,
  MIN_INTERVAL_SEC,
  MIN_SESSION_DURATION_SEC,
} from "../constants.ts";
import { epochMsSchema, precisionSchema, sessionStatusSchema } from "./common.ts";

// セッションのスキーマ。追跡は expires_at で自動終了し無期限にしない。

export const intervalSecSchema = z.number().int().min(MIN_INTERVAL_SEC).max(MAX_INTERVAL_SEC);

// 有効期間は秒で受け、starts_at と expires_at はサーバー時刻から確定する。端末時計に依存させない。
export const durationSecSchema = z
  .number()
  .int()
  .min(MIN_SESSION_DURATION_SEC)
  .max(MAX_SESSION_DURATION_SEC);

export const createSessionInputSchema = z
  .object({
    title: z.string().min(1).max(100),
    intervalSec: intervalSecSchema,
    durationSec: durationSecSchema,
    precision: precisionSchema.default("exact"),
  })
  .refine((v) => v.durationSec >= v.intervalSec, {
    message: "durationSec は intervalSec 以上である必要があります",
    path: ["durationSec"],
  });
export type CreateSessionInput = z.infer<typeof createSessionInputSchema>;

export const sessionSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  title: z.string(),
  intervalSec: intervalSecSchema,
  startsAt: epochMsSchema,
  expiresAt: epochMsSchema,
  precision: precisionSchema,
  status: sessionStatusSchema,
  nextDisclosureAt: epochMsSchema.nullable(),
  createdAt: epochMsSchema,
});
export type Session = z.infer<typeof sessionSchema>;
