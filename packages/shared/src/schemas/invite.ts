import { z } from "zod";

import { epochMsSchema } from "./common.ts";

// 招待のスキーマ。招待に含めた権限が参加後の membership の上限になる。
export const inviteSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  code: z.string(),
  allowSharing: z.boolean(),
  allowViewing: z.boolean(),
  revokedAt: epochMsSchema.nullable(),
  createdAt: epochMsSchema,
});
export type Invite = z.infer<typeof inviteSchema>;

// 両方 false の招待は参加しても何もできないため発行を拒否する。
export const createInviteInputSchema = z
  .object({
    allowSharing: z.boolean(),
    allowViewing: z.boolean(),
  })
  .refine((v) => v.allowSharing || v.allowViewing, {
    message: "少なくとも一方の権限を含める必要があります",
  });
export type CreateInviteInput = z.infer<typeof createInviteInputSchema>;

export const inviteResponseSchema = z.object({
  invite: inviteSchema,
});
export type InviteResponse = z.infer<typeof inviteResponseSchema>;

export const inviteListResponseSchema = z.object({
  invites: z.array(inviteSchema),
});
export type InviteListResponse = z.infer<typeof inviteListResponseSchema>;
