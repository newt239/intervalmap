import { z } from "zod";

import { MAX_INTERVAL_SEC, MAX_SESSION_DURATION_SEC, MIN_INTERVAL_SEC } from "../constants.ts";
import { epochMsSchema, precisionSchema, sessionStatusSchema } from "./common.ts";

// セッションのスキーマ。追跡は expires_at で自動終了し無期限にしない。

export const intervalSecSchema = z.number().int().min(MIN_INTERVAL_SEC).max(MAX_INTERVAL_SEC);

export const createSessionInputSchema = z
  .object({
    title: z.string().min(1).max(100),
    intervalSec: intervalSecSchema,
    startsAt: epochMsSchema,
    expiresAt: epochMsSchema,
    precision: precisionSchema.default("exact"),
  })
  .refine((v) => v.expiresAt > v.startsAt, {
    message: "expiresAt は startsAt より後である必要があります",
    path: ["expiresAt"],
  })
  .refine((v) => v.expiresAt - v.startsAt <= MAX_SESSION_DURATION_SEC * 1000, {
    message: "セッションの有効期間が上限を超えています",
    path: ["expiresAt"],
  });
export type CreateSessionInput = z.infer<typeof createSessionInputSchema>;

export const sessionSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  title: z.string(),
  inviteCode: z.string(),
  intervalSec: intervalSecSchema,
  startsAt: epochMsSchema,
  expiresAt: epochMsSchema,
  precision: precisionSchema,
  status: sessionStatusSchema,
  nextDisclosureAt: epochMsSchema.nullable(),
  createdAt: epochMsSchema,
});
export type Session = z.infer<typeof sessionSchema>;
