import * as SecureStore from "expo-secure-store";

import { apiFetch } from "#/lib/api-client";
import { authResponseSchema } from "@intervalmap/shared";

// 匿名デバイス認証の永続化。トークンは SecureStore にのみ保存する。
const AUTH_KEY = "intervalmap-auth";

export type StoredAuth = {
  token: string;
  userId: string;
  displayName: string;
};

export const loadAuth = async (): Promise<StoredAuth | null> => {
  const raw = await SecureStore.getItemAsync(AUTH_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
};

// 未登録なら displayName で匿名ユーザーを作成し、登録済みならそれを返す。
export const ensureRegistered = async (displayName: string): Promise<StoredAuth> => {
  const existing = await loadAuth();
  if (existing) {
    return existing;
  }
  const res = await apiFetch(authResponseSchema, "/users", {
    method: "POST",
    body: JSON.stringify({ displayName }),
  });
  const auth: StoredAuth = {
    token: res.token,
    userId: res.user.id,
    displayName: res.user.displayName,
  };
  // 端末ロック中のバックグラウンドタスクからも読めるよう AFTER_FIRST_UNLOCK にする。
  await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(auth), {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });
  return auth;
};
