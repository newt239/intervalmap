import { z } from "zod";

import { MAX_INTERVAL_SEC, MIN_INTERVAL_SEC } from "../constants.ts";
import { epochMsSchema, precisionSchema, sessionStatusSchema } from "./common.ts";

// セッションのスキーマ。終了は主催者の手動操作だが、追跡は expires_at の安全網で必ず終わる。

export const intervalSecSchema = z.number().int().min(MIN_INTERVAL_SEC).max(MAX_INTERVAL_SEC);

export const createSessionInputSchema = z.object({
  title: z.string().min(1).max(100),
  intervalSec: intervalSecSchema,
  precision: precisionSchema.default("exact"),
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
  // 招待リンクのコード。主催者以外には null を返す。
  inviteCode: z.string().nullable(),
  createdAt: epochMsSchema,
});
export type Session = z.infer<typeof sessionSchema>;
