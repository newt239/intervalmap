import { errorResponseSchema } from "@intervalmap/shared";

import type { z } from "zod";

// API ベース URL。EXPO_PUBLIC_API_URL はビルド時に埋め込まれ、未設定時はローカル開発用。
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type ApiInit = Omit<RequestInit, "headers"> & {
  token?: string | null;
  headers?: Record<string, string>;
};

// レスポンスは Zod スキーマで検証してから返す。API 境界の単一の真実は shared に置く。
export const apiFetch = async <T>(
  schema: z.ZodType<T>,
  path: string,
  init?: ApiInit,
): Promise<T> => {
  const { token, headers, ...rest } = init ?? {};
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (!res.ok) {
    const parsed = errorResponseSchema.safeParse(await res.json().catch(() => null));
    if (parsed.success) {
      throw new ApiError(res.status, parsed.data.error.code, parsed.data.error.message);
    }
    throw new ApiError(res.status, "unknown", `HTTP ${res.status}`);
  }
  return schema.parse(await res.json());
};
