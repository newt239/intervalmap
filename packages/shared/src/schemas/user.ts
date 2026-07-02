import { z } from "zod";

import { epochMsSchema } from "./common.ts";

// ユーザーのスキーマ。初期は匿名デバイス認証で、初回起動時に作成する。

export const userSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  createdAt: epochMsSchema,
});
export type User = z.infer<typeof userSchema>;

export const registerUserInputSchema = z.object({
  displayName: z.string().min(1).max(50),
});
export type RegisterUserInput = z.infer<typeof registerUserInputSchema>;
