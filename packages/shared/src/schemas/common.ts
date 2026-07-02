import { z } from "zod";

// API 境界で共有する基本スキーマ。時刻は epoch ミリ秒でサーバー権威。

export const epochMsSchema = z.number().int().nonnegative();

// 位置精度の段階。exact は正確、coarse はおおまか。
export const precisionSchema = z.enum(["exact", "coarse"]);
export type Precision = z.infer<typeof precisionSchema>;

export const sessionStatusSchema = z.enum(["scheduled", "active", "ended"]);
export type SessionStatus = z.infer<typeof sessionStatusSchema>;

// メンバーの役割。owner はセッション主催者。
export const roleSchema = z.enum(["owner", "member"]);
export type Role = z.infer<typeof roleSchema>;

export const latSchema = z.number().min(-90).max(90);
export const lngSchema = z.number().min(-180).max(180);
