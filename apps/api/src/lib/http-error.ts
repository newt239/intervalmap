import type { ErrorResponse } from "@intervalmap/shared";

import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

// エラーレスポンスの共通形。code はクライアントの分岐キーになるため安定させる。
export const jsonError = (
  c: Context,
  status: ContentfulStatusCode,
  code: string,
  message: string,
) => {
  const body: ErrorResponse = { error: { code, message } };
  return c.json(body, status);
};
