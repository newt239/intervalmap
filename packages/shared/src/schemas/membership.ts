import { z } from "zod";

import { epochMsSchema, roleSchema } from "./common.ts";

// メンバーシップのスキーマ。
export const membershipSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  userId: z.string(),
  displayName: z.string(),
  role: roleSchema,
  sharingEnabled: z.boolean(),
  lastUploadedAt: epochMsSchema.nullable(),
  joinedAt: epochMsSchema,
});
export type Membership = z.infer<typeof membershipSchema>;
