import { and, asc, desc, eq, lte, or } from "drizzle-orm";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { Hono } from "hono";

import {
  createSessionInputSchema,
  INVITE_CODE_LENGTH,
  joinSessionInputSchema,
  updateMembershipInputSchema,
  uploadLocationsInputSchema,
  type DisclosedLocation,
  type HistoryResponse,
  type MapResponse,
  type Membership,
  type MembershipResponse,
  type Session,
  type SessionDetailResponse,
  type SessionListResponse,
  type SessionWithMembershipResponse,
  type UploadLocationsResponse,
} from "@intervalmap/shared";

import {
  disclosures,
  locationPoints,
  memberships,
  sessions,
  users,
  type LocationPointRow,
  type MembershipRow,
  type SessionRow,
} from "../db/schema.ts";
import { buildDisclosedTrack } from "../domain/history.ts";
import { reconcileSessionStatus, resolveSessionStatus } from "../domain/session-status.ts";
import { notifySessionEnd } from "../domain/tick.ts";
import { jsonError } from "../lib/http-error.ts";
import { requireAuth, type AuthEnv } from "../middleware/auth.ts";

// D1 のバインドパラメータ上限100を超えないよう位置点の insert を分割する。
const LOCATION_INSERT_CHUNK = 10;

// 招待コードは短命かつ推測不能であること。紛らわしい文字を除いた32文字で modulo バイアスもない。
const INVITE_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

const newInviteCode = (): string => {
  const bytes = new Uint8Array(INVITE_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => INVITE_ALPHABET.charAt(b % INVITE_ALPHABET.length)).join("");
};

const toSessionDto = (row: SessionRow): Session => ({
  id: row.id,
  ownerId: row.ownerId,
  title: row.title,
  inviteCode: row.inviteCode,
  viewerInviteCode: row.viewerInviteCode,
  intervalSec: row.intervalSec,
  startsAt: row.startsAt,
  expiresAt: row.expiresAt,
  precision: row.precision,
  status: row.status,
  nextDisclosureAt: row.nextDisclosureAt,
  createdAt: row.createdAt,
});

const toMembershipDto = (row: MembershipRow, displayName: string): Membership => ({
  id: row.id,
  sessionId: row.sessionId,
  userId: row.userId,
  displayName,
  role: row.role,
  sharingEnabled: row.sharingEnabled,
  viewingEnabled: row.viewingEnabled,
  lastUploadedAt: row.lastUploadedAt,
  joinedAt: row.joinedAt,
});

const findSessionById = async (db: DrizzleD1Database, id: string): Promise<SessionRow | null> => {
  const [row] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  return row ?? null;
};

const findMembership = async (
  db: DrizzleD1Database,
  sessionId: string,
  userId: string,
): Promise<MembershipRow | null> => {
  const [row] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.sessionId, sessionId), eq(memberships.userId, userId)))
    .limit(1);
  return row ?? null;
};

// 指定時点以前で最新の位置を返す。disclosedAt が null なら時点制限なし。
const findLatestPoint = async (
  db: DrizzleD1Database,
  membershipId: string,
  disclosedAt: number | null,
) => {
  const timeBound =
    disclosedAt === null
      ? undefined
      : and(
          // 開示前の位置を返さない不変条件。captured/uploaded 両方で時点を締める。
          lte(locationPoints.capturedAt, disclosedAt),
          lte(locationPoints.uploadedAt, disclosedAt),
        );
  const [row] = await db
    .select()
    .from(locationPoints)
    .where(and(eq(locationPoints.membershipId, membershipId), timeBound))
    .orderBy(desc(locationPoints.capturedAt))
    .limit(1);
  return row ?? null;
};

export const sessionsRoute = new Hono<AuthEnv>()
  .use(requireAuth)

  // セッション作成。starts_at と expires_at はサーバー時刻から確定する。
  .post("/", async (c) => {
    const parsed = createSessionInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(c, 400, "invalid_request", "リクエストボディが不正です");
    }
    const user = c.get("user");
    const db = drizzle(c.env.DB);
    const now = Date.now();
    const startsAt = now;
    const expiresAt = startsAt + parsed.data.durationSec * 1000;

    // 招待コードの unique 衝突に備えて数回リトライする。
    let sessionRow: SessionRow | null = null;
    for (let attempt = 0; attempt < 3 && sessionRow === null; attempt++) {
      const candidate: SessionRow = {
        id: crypto.randomUUID(),
        ownerId: user.id,
        title: parsed.data.title,
        inviteCode: newInviteCode(),
        viewerInviteCode: newInviteCode(),
        intervalSec: parsed.data.intervalSec,
        startsAt,
        expiresAt,
        precision: parsed.data.precision,
        status: "active",
        // 初回開示は開始から1インターバル後。
        nextDisclosureAt: startsAt + parsed.data.intervalSec * 1000,
        endedAt: null,
        createdAt: now,
      };
      try {
        await db.insert(sessions).values(candidate);
        sessionRow = candidate;
      } catch {
        // unique 制約違反とみなして再試行する。
      }
    }
    if (sessionRow === null) {
      return jsonError(c, 500, "session_create_failed", "セッションを作成できませんでした");
    }

    const membershipRow: MembershipRow = {
      id: crypto.randomUUID(),
      sessionId: sessionRow.id,
      userId: user.id,
      role: "owner",
      sharingEnabled: true,
      viewingEnabled: true,
      lastUploadedAt: null,
      joinedAt: now,
    };
    await db.insert(memberships).values(membershipRow);

    const body: SessionWithMembershipResponse = {
      session: toSessionDto(sessionRow),
      membership: toMembershipDto(membershipRow, user.displayName),
    };
    return c.json(body, 201);
  })

  // 参加中セッション一覧。
  .get("/", async (c) => {
    const user = c.get("user");
    const db = drizzle(c.env.DB);
    const now = Date.now();

    const rows = await db
      .select({ session: sessions, membership: memberships })
      .from(memberships)
      .innerJoin(sessions, eq(memberships.sessionId, sessions.id))
      .where(eq(memberships.userId, user.id))
      .orderBy(desc(sessions.createdAt));

    const body: SessionListResponse = {
      serverNow: now,
      sessions: rows.map((r) => {
        // 一覧でも期限切れを active と見せない。
        const status = resolveSessionStatus(r.session, now);
        return {
          session: toSessionDto({
            ...r.session,
            status,
            nextDisclosureAt: status === "ended" ? null : r.session.nextDisclosureAt,
          }),
          membership: toMembershipDto(r.membership, user.displayName),
        };
      }),
    };
    return c.json(body);
  })

  // 招待コードで参加する。終了済みセッションには参加できない。
  .post("/join", async (c) => {
    const parsed = joinSessionInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(c, 400, "invalid_request", "リクエストボディが不正です");
    }
    const user = c.get("user");
    const db = drizzle(c.env.DB);
    const now = Date.now();

    const [found] = await db
      .select()
      .from(sessions)
      .where(
        or(
          eq(sessions.inviteCode, parsed.data.inviteCode),
          eq(sessions.viewerInviteCode, parsed.data.inviteCode),
        ),
      )
      .limit(1);
    if (!found) {
      return jsonError(c, 404, "session_not_found", "招待コードが見つかりません");
    }
    const session = await reconcileSessionStatus(db, found, now);
    if (session.status === "ended") {
      return jsonError(c, 410, "session_ended", "このセッションは終了しています");
    }

    // 閲覧用コードで参加したメンバーは共有オフで始まる。以降は本人が設定で変更できる。
    const asViewer = parsed.data.inviteCode === session.viewerInviteCode;
    const existing = await findMembership(db, session.id, user.id);
    const membershipRow: MembershipRow = existing ?? {
      id: crypto.randomUUID(),
      sessionId: session.id,
      userId: user.id,
      role: "member",
      sharingEnabled: !asViewer,
      viewingEnabled: true,
      lastUploadedAt: null,
      joinedAt: now,
    };
    if (!existing) {
      await db.insert(memberships).values(membershipRow);
    }

    const body: SessionWithMembershipResponse = {
      session: toSessionDto(session),
      membership: toMembershipDto(membershipRow, user.displayName),
    };
    return c.json(body, existing ? 200 : 201);
  })

  // セッション詳細。メンバーのみ閲覧できる。
  .get("/:id", async (c) => {
    const user = c.get("user");
    const db = drizzle(c.env.DB);
    const now = Date.now();

    const found = await findSessionById(db, c.req.param("id"));
    if (!found) {
      return jsonError(c, 404, "session_not_found", "セッションが見つかりません");
    }
    const membership = await findMembership(db, found.id, user.id);
    if (!membership) {
      return jsonError(c, 403, "not_a_member", "このセッションのメンバーではありません");
    }
    const session = await reconcileSessionStatus(db, found, now);

    const memberRows = await db
      .select({ membership: memberships, displayName: users.displayName })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.sessionId, session.id));

    const body: SessionDetailResponse = {
      session: toSessionDto(session),
      members: memberRows.map((r) => toMembershipDto(r.membership, r.displayName)),
    };
    return c.json(body);
  })

  // 自分の共有・閲覧設定の更新。他人の設定は変更できない。
  .patch("/:id/me", async (c) => {
    const parsed = updateMembershipInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(c, 400, "invalid_request", "リクエストボディが不正です");
    }
    const user = c.get("user");
    const db = drizzle(c.env.DB);

    const found = await findSessionById(db, c.req.param("id"));
    if (!found) {
      return jsonError(c, 404, "session_not_found", "セッションが見つかりません");
    }
    const membership = await findMembership(db, found.id, user.id);
    if (!membership) {
      return jsonError(c, 403, "not_a_member", "このセッションのメンバーではありません");
    }

    const updated: MembershipRow = {
      ...membership,
      sharingEnabled: parsed.data.sharingEnabled ?? membership.sharingEnabled,
      viewingEnabled: parsed.data.viewingEnabled ?? membership.viewingEnabled,
    };
    await db
      .update(memberships)
      .set({ sharingEnabled: updated.sharingEnabled, viewingEnabled: updated.viewingEnabled })
      .where(eq(memberships.id, membership.id));

    const body: MembershipResponse = { membership: toMembershipDto(updated, user.displayName) };
    return c.json(body);
  })

  // 主催者による即時終了。
  .post("/:id/end", async (c) => {
    const user = c.get("user");
    const db = drizzle(c.env.DB);
    const now = Date.now();

    const found = await findSessionById(db, c.req.param("id"));
    if (!found) {
      return jsonError(c, 404, "session_not_found", "セッションが見つかりません");
    }
    if (found.ownerId !== user.id) {
      return jsonError(c, 403, "not_owner", "主催者のみ終了できます");
    }
    const ended: SessionRow = { ...found, status: "ended", nextDisclosureAt: null, endedAt: now };
    await db
      .update(sessions)
      .set({ status: "ended", nextDisclosureAt: null, endedAt: now })
      .where(eq(sessions.id, found.id));
    // 終了通知は即時に送る。alerts が台帳になるため Cron と重複しない。
    await notifySessionEnd(db, ended, now);

    const body: SessionDetailResponse["session"] = toSessionDto(ended);
    return c.json({ session: body });
  })

  // 位置のバッチアップロード。ended 以降はサーバー側で必ず拒否する不変条件。
  .post("/:id/locations", async (c) => {
    const parsed = uploadLocationsInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(c, 400, "invalid_request", "リクエストボディが不正です");
    }
    const user = c.get("user");
    const db = drizzle(c.env.DB);
    const now = Date.now();

    const found = await findSessionById(db, c.req.param("id"));
    if (!found) {
      return jsonError(c, 404, "session_not_found", "セッションが見つかりません");
    }
    const membership = await findMembership(db, found.id, user.id);
    if (!membership) {
      return jsonError(c, 403, "not_a_member", "このセッションのメンバーではありません");
    }
    const session = await reconcileSessionStatus(db, found, now);
    if (session.status === "ended") {
      // 期限後・終了後の追跡を許さない。クライアント側の自走停止と二重化する。
      return jsonError(c, 410, "session_ended", "セッションは終了しています");
    }
    if (session.status !== "active") {
      return jsonError(c, 409, "session_not_active", "セッションが開始されていません");
    }
    if (!membership.sharingEnabled) {
      // 共有オフ中の位置を保存しない。保存すると再オン時に過去の位置が開示されてしまう。
      return jsonError(c, 409, "sharing_disabled", "位置共有がオフになっています");
    }

    const rows = parsed.data.points.map((p) => ({
      id: crypto.randomUUID(),
      sessionId: session.id,
      membershipId: membership.id,
      capturedAt: p.capturedAt,
      lat: p.lat,
      lng: p.lng,
      accuracyM: p.accuracyM,
      battery: p.battery,
      uploadedAt: now,
    }));
    for (let i = 0; i < rows.length; i += LOCATION_INSERT_CHUNK) {
      await db.insert(locationPoints).values(rows.slice(i, i + LOCATION_INSERT_CHUNK));
    }
    await db
      .update(memberships)
      .set({ lastUploadedAt: now })
      .where(eq(memberships.id, membership.id));

    const body: UploadLocationsResponse = { accepted: rows.length, sessionStatus: session.status };
    return c.json(body);
  })

  // 開示ビュー。最新 disclosure 時点の各メンバー位置のみ返す。
  // disclosure 以降の点は絶対に返さない。ただし自分自身の現在位置は常に見えてよい。
  .get("/:id/map", async (c) => {
    const user = c.get("user");
    const db = drizzle(c.env.DB);
    const now = Date.now();

    const found = await findSessionById(db, c.req.param("id"));
    if (!found) {
      return jsonError(c, 404, "session_not_found", "セッションが見つかりません");
    }
    const selfMembership = await findMembership(db, found.id, user.id);
    if (!selfMembership) {
      return jsonError(c, 403, "not_a_member", "このセッションのメンバーではありません");
    }
    const session = await reconcileSessionStatus(db, found, now);

    const [latestDisclosure] = await db
      .select()
      .from(disclosures)
      .where(eq(disclosures.sessionId, session.id))
      .orderBy(desc(disclosures.disclosedAt))
      .limit(1);
    const disclosedAt = latestDisclosure?.disclosedAt ?? null;

    const memberRows = await db
      .select({ membership: memberships, displayName: users.displayName })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.sessionId, session.id));

    // 開示済み位置。disclosure がまだ無ければ誰の位置も返さない。
    // 閲覧オフの本人には他メンバーの位置をサーバー側で返さない。
    let disclosed: DisclosedLocation[] = [];
    if (disclosedAt !== null && selfMembership.viewingEnabled) {
      const results = await Promise.all(
        memberRows
          .filter((r) => r.membership.sharingEnabled)
          .map(async (r) => {
            const point = await findLatestPoint(db, r.membership.id, disclosedAt);
            if (!point) {
              return null;
            }
            return {
              membershipId: r.membership.id,
              displayName: r.displayName,
              lat: point.lat,
              lng: point.lng,
              accuracyM: point.accuracyM,
              capturedAt: point.capturedAt,
            };
          }),
      );
      disclosed = results.filter((loc) => loc !== null);
    }

    // 自分自身の現在位置は開示を待たずに返す。
    const selfPoint = await findLatestPoint(db, selfMembership.id, null);
    const self: DisclosedLocation | null = selfPoint
      ? {
          membershipId: selfMembership.id,
          displayName: user.displayName,
          lat: selfPoint.lat,
          lng: selfPoint.lng,
          accuracyM: selfPoint.accuracyM,
          capturedAt: selfPoint.capturedAt,
        }
      : null;

    const body: MapResponse = {
      serverNow: now,
      disclosedAt,
      nextDisclosureAt: session.nextDisclosureAt,
      sessionStatus: session.status,
      locations: disclosed,
      self,
    };
    return c.json(body);
  })

  // 移動履歴。開示済みスナップショットの系列のみ返し、開示前の点は SQL と buildDisclosedTrack で二重に除外する。
  .get("/:id/history", async (c) => {
    const user = c.get("user");
    const db = drizzle(c.env.DB);
    const now = Date.now();

    const found = await findSessionById(db, c.req.param("id"));
    if (!found) {
      return jsonError(c, 404, "session_not_found", "セッションが見つかりません");
    }
    const selfMembership = await findMembership(db, found.id, user.id);
    if (!selfMembership) {
      return jsonError(c, 403, "not_a_member", "このセッションのメンバーではありません");
    }
    const session = await reconcileSessionStatus(db, found, now);

    const disclosureRows = await db
      .select()
      .from(disclosures)
      .where(eq(disclosures.sessionId, session.id))
      .orderBy(asc(disclosures.disclosedAt));
    const disclosedAts = disclosureRows.map((d) => d.disclosedAt);
    const latestDisclosedAt = disclosedAts.at(-1) ?? null;

    const tracks: HistoryResponse["tracks"] = [];
    if (latestDisclosedAt !== null) {
      const memberRows = await db
        .select({ membership: memberships, displayName: users.displayName })
        .from(memberships)
        .innerJoin(users, eq(memberships.userId, users.id))
        .where(eq(memberships.sessionId, session.id));

      const pointRows = await db
        .select()
        .from(locationPoints)
        .where(
          and(
            eq(locationPoints.sessionId, session.id),
            lte(locationPoints.capturedAt, latestDisclosedAt),
            lte(locationPoints.uploadedAt, latestDisclosedAt),
          ),
        )
        .orderBy(asc(locationPoints.capturedAt));

      const byMembership = new Map<string, LocationPointRow[]>();
      for (const row of pointRows) {
        const list = byMembership.get(row.membershipId) ?? [];
        list.push(row);
        byMembership.set(row.membershipId, list);
      }

      for (const r of memberRows) {
        // 共有オフのメンバーの履歴は本人以外に出さない。閲覧オフの本人には他人の履歴を出さない。
        if (
          r.membership.id !== selfMembership.id &&
          (!r.membership.sharingEnabled || !selfMembership.viewingEnabled)
        ) {
          continue;
        }
        const points = buildDisclosedTrack(disclosedAts, byMembership.get(r.membership.id) ?? []);
        if (points.length > 0) {
          tracks.push({ membershipId: r.membership.id, displayName: r.displayName, points });
        }
      }
    }

    const body: HistoryResponse = {
      serverNow: now,
      sessionStatus: session.status,
      tracks,
    };
    return c.json(body);
  });
