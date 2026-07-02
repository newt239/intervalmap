import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "#/lib/api-client";
import { authQueryKey, loadAuth } from "#/lib/auth";
import { locationTracker } from "#/lib/location/tracker";
import {
  historyResponseSchema,
  mapResponseSchema,
  sessionDetailResponseSchema,
  sessionListResponseSchema,
} from "@intervalmap/shared";

export const useAuth = () =>
  useQuery({ queryKey: authQueryKey, queryFn: loadAuth, staleTime: Infinity });

export const useSessionList = (token: string | undefined) =>
  useQuery({
    queryKey: ["sessions"],
    queryFn: () => apiFetch(sessionListResponseSchema, "/sessions", { token }),
    enabled: token !== undefined,
  });

export const sessionDetailQueryKey = (sessionId: string) =>
  ["session", sessionId, "detail"] as const;

export const useSessionDetail = (sessionId: string, token: string | undefined) =>
  useQuery({
    queryKey: sessionDetailQueryKey(sessionId),
    queryFn: () => apiFetch(sessionDetailResponseSchema, `/sessions/${sessionId}`, { token }),
    enabled: token !== undefined,
    refetchInterval: (query) => (query.state.data?.session.status === "ended" ? false : 30_000),
  });

export const useSessionMap = (sessionId: string, token: string | undefined) =>
  useQuery({
    queryKey: ["session", sessionId, "map"],
    queryFn: async () => {
      const res = await apiFetch(mapResponseSchema, `/sessions/${sessionId}/map`, { token });
      // 追跡は必ず有限。セッション終了を検知したら端末側の追跡も止め、サーバー側の拒否と二重化する。
      if (res.sessionStatus === "ended") {
        await locationTracker.stop().catch(() => {});
      }
      // serverNow と端末時計の差。カウントダウンを端末時計に依存させないための補正値。
      return { ...res, clockOffset: res.serverNow - Date.now() };
    },
    enabled: token !== undefined,
    // 開示予定があればその2秒後に1回だけ、無ければ30秒間隔で再取得する。
    refetchInterval: (query) => {
      const { data } = query.state;
      if (!data || data.sessionStatus === "ended") {
        return false;
      }
      return data.nextDisclosureAt !== null
        ? Math.max(2000, data.nextDisclosureAt - data.serverNow + 2000)
        : 30_000;
    },
  });

// disclosedAt に map の serverNow を渡し、開示のたびに履歴も追随して再取得させる。
export const useSessionHistory = (
  sessionId: string,
  token: string | undefined,
  disclosedAt: number | undefined,
) =>
  useQuery({
    queryKey: ["session", sessionId, "history", disclosedAt ?? 0],
    queryFn: () => apiFetch(historyResponseSchema, `/sessions/${sessionId}/history`, { token }),
    enabled: token !== undefined && disclosedAt !== undefined,
    placeholderData: (prev) => prev,
  });
