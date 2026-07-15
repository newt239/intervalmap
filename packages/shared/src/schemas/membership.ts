import { z } from "zod";

import { epochMsSchema, roleSchema } from "./common.ts";

// メンバーシップのスキーマ。sharingEnabled は自分の位置の共有、viewingEnabled は他メンバーの位置の閲覧。
export const membershipSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  userId: z.string(),
  displayName: z.string(),
  role: roleSchema,
  sharingEnabled: z.boolean(),
  viewingEnabled: z.boolean(),
  // 招待で許可された上限。sharingEnabled / viewingEnabled はこの範囲でのみ有効化できる。
  allowedSharing: z.boolean(),
  allowedViewing: z.boolean(),
  lastUploadedAt: epochMsSchema.nullable(),
  joinedAt: epochMsSchema,
});
export type Membership = z.infer<typeof membershipSchema>;
