import { z } from "zod";

import { epochMsSchema, roleSchema } from "./common.ts";

// メンバーシップのスキーマ。参加すれば位置の共有も閲覧もでき、退出は leftAt で記録する。
export const membershipSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  userId: z.string(),
  displayName: z.string(),
  role: roleSchema,
  lastUploadedAt: epochMsSchema.nullable(),
  joinedAt: epochMsSchema,
  leftAt: epochMsSchema.nullable(),
});
export type Membership = z.infer<typeof membershipSchema>;
