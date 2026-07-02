import * as SecureStore from "expo-secure-store";

import { apiFetch } from "#/lib/api-client";
import { queryClient } from "#/lib/query-client";
import { authResponseSchema, userResponseSchema } from "@intervalmap/shared";

// 匿名デバイス認証の永続化。トークンは SecureStore にのみ保存する。
const AUTH_KEY = "intervalmap-auth";

export const authQueryKey = ["auth"] as const;

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
  queryClient.setQueryData(authQueryKey, auth);
  return auth;
};

// 登録済みユーザーの表示名をサーバーと SecureStore の両方で更新する。
export const updateDisplayName = async (displayName: string): Promise<StoredAuth> => {
  const existing = await loadAuth();
  if (!existing) {
    return ensureRegistered(displayName);
  }
  const res = await apiFetch(userResponseSchema, "/users/me", {
    method: "PATCH",
    token: existing.token,
    body: JSON.stringify({ displayName }),
  });
  const auth: StoredAuth = { ...existing, displayName: res.user.displayName };
  await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(auth), {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });
  queryClient.setQueryData(authQueryKey, auth);
  return auth;
};
