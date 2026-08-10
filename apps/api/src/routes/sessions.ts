import { and, asc, desc, eq, isNull, lte } from "drizzle-orm";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { Hono } from "hono";

import {
  createSessionInputSchema,
  INVITE_ALPHABET,
  INVITE_CODE_LENGTH,
  joinSessionInputSchema,
  MAX_SESSION_DURATION_SEC,
  uploadLocationsInputSchema,
  type DisclosedLocation,
  type HistoryResponse,
  type MapResponse,
  type Membership,
  type MembershipResponse,
  type Session,
  type SessionDetailResponse,
  type SessionListResponse,
  type SessionResponse,
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

const newInviteCode = (): string => {
  const bytes = new Uint8Array(INVITE_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => INVITE_ALPHABET.charAt(b % INVITE_ALPHABET.length)).join("");
};

// 招待リンクを配れるのは主催者だけなので、コードは主催者にしか返さない。
const toSessionDto = (row: SessionRow, viewerId: string): Session => ({
  id: row.id,
  ownerId: row.ownerId,
  title: row.title,
  intervalSec: row.intervalSec,
  startsAt: row.startsAt,
  expiresAt: row.expiresAt,
  precision: row.precision,
  status: row.status,
  nextDisclosureAt: row.nextDisclosureAt,
  inviteCode: row.ownerId === viewerId ? row.inviteCode : null,
  createdAt: row.createdAt,
});

const toMembershipDto = (row: MembershipRow, displayName: string): Membership => ({
  id: row.id,
  sessionId: row.sessionId,
  userId: row.userId,
  displayName,
  role: row.role,
  lastUploadedAt: row.lastUploadedAt,
  joinedAt: row.joinedAt,
  leftAt: row.leftAt,
});

const findSessionById = async (db: DrizzleD1Database, id: string): Promise<SessionRow | null> => {
  const [row] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  return row ?? null;
};

// 参加中のメンバーのみ返す。退出済みは地図・履歴・アップロードのすべてで対象外になる。
const findMembership = async (
  db: DrizzleD1Database,
  sessionId: string,
  userId: string,
): Promise<MembershipRow | null> => {
  const [row] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.sessionId, sessionId),
        eq(memberships.userId, userId),
        isNull(memberships.leftAt),
      ),
    )
    .limit(1);
  return row ?? null;
};

// 参加中メンバーを表示名付きで返す。
const findActiveMembers = async (db: DrizzleD1Database, sessionId: string) =>
  db
    .select({ membership: memberships, displayName: users.displayName })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(and(eq(memberships.sessionId, sessionId), isNull(memberships.leftAt)));

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

  // セッション作成。終了は主催者の手動操作だが、期限は安全網としてサーバーが必ず入れる。
  .post("/", async (c) => {
    const parsed = createSessionInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(c, 400, "invalid_request", "リクエストボディが不正です");
    }
    const user = c.get("user");
    const db = drizzle(c.env.DB);
    const now = Date.now();

    const sessionRow: SessionRow = {
      id: crypto.randomUUID(),
      ownerId: user.id,
      title: parsed.data.title,
      inviteCode: newInviteCode(),
      intervalSec: parsed.data.intervalSec,
      startsAt: now,
      // 無期限追跡を作らないための安全網。通常は主催者が手動で終了させる。
      expiresAt: now + MAX_SESSION_DURATION_SEC * 1000,
      precision: parsed.data.precision,
      status: "active",
      // 初回開示は開始から1インターバル後。
      nextDisclosureAt: now + parsed.data.intervalSec * 1000,
      endedAt: null,
      createdAt: now,
    };
    await db.insert(sessions).values(sessionRow);

    const membershipRow: MembershipRow = {
      id: crypto.randomUUID(),
      sessionId: sessionRow.id,
      userId: user.id,
      role: "owner",
      lastUploadedAt: null,
      joinedAt: now,
      leftAt: null,
    };
    await db.insert(memberships).values(membershipRow);

    const body: SessionWithMembershipResponse = {
      session: toSessionDto(sessionRow, user.id),
      membership: toMembershipDto(membershipRow, user.displayName),
    };
    return c.json(body, 201);
  })

  // 参加中セッション一覧。退出したセッションは含めない。
  .get("/", async (c) => {
    const user = c.get("user");
    const db = drizzle(c.env.DB);
    const now = Date.now();

    const rows = await db
      .select({ session: sessions, membership: memberships })
      .from(memberships)
      .innerJoin(sessions, eq(memberships.sessionId, sessions.id))
      .where(and(eq(memberships.userId, user.id), isNull(memberships.leftAt)))
      .orderBy(desc(sessions.createdAt));

    const body: SessionListResponse = {
      serverNow: now,
      sessions: rows.map((r) => {
        // 一覧でも期限切れを active と見せない。
        const status = resolveSessionStatus(r.session, now);
        return {
          session: toSessionDto(
            {
              ...r.session,
              status,
              nextDisclosureAt: status === "ended" ? null : r.session.nextDisclosureAt,
            },
            user.id,
          ),
          membership: toMembershipDto(r.membership, user.displayName),
        };
      }),
    };
    return c.json(body);
  })

  // 招待リンクのコードで参加する。参加すれば位置の共有も閲覧もできる。
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
      .where(eq(sessions.inviteCode, parsed.data.inviteCode))
      .limit(1);
    if (!found) {
      return jsonError(c, 404, "invite_not_found", "招待コードが見つかりません");
    }
    const session = await reconcileSessionStatus(db, found, now);
    if (session.status === "ended") {
      return jsonError(c, 410, "session_ended", "このセッションは終了しています");
    }

    // 退出済みの membership は復活させ、履歴もそのまま引き継ぐ。
    const [existing] = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.sessionId, session.id), eq(memberships.userId, user.id)))
      .limit(1);
    const membershipRow: MembershipRow = existing
      ? { ...existing, leftAt: null }
      : {
          id: crypto.randomUUID(),
          sessionId: session.id,
          userId: user.id,
          role: "member",
          lastUploadedAt: null,
          joinedAt: now,
          leftAt: null,
        };
    if (existing) {
      await db.update(memberships).set({ leftAt: null }).where(eq(memberships.id, existing.id));
    } else {
      await db.insert(memberships).values(membershipRow);
    }

    const body: SessionWithMembershipResponse = {
      session: toSessionDto(session, user.id),
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
    const memberRows = await findActiveMembers(db, session.id);

    const body: SessionDetailResponse = {
      session: toSessionDto(session, user.id),
      members: memberRows.map((r) => toMembershipDto(r.membership, r.displayName)),
    };
    return c.json(body);
  })

  // 参加者の退出。主催者は退出できず、終了させることで全員の追跡を止める。
  .delete("/:id/me", async (c) => {
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
    if (membership.role === "owner") {
      return jsonError(c, 403, "owner_cannot_leave", "主催者は退出できません。終了させてください");
    }

    await db.update(memberships).set({ leftAt: now }).where(eq(memberships.id, membership.id));

    const body: MembershipResponse = {
      membership: toMembershipDto({ ...membership, leftAt: now }, user.displayName),
    };
    return c.json(body);
  })

  // 招待リンクの再生成。漏れたリンクを止める唯一の手段なので主催者のみ許す。
  .post("/:id/invite/regenerate", async (c) => {
    const user = c.get("user");
    const db = drizzle(c.env.DB);

    const found = await findSessionById(db, c.req.param("id"));
    if (!found) {
      return jsonError(c, 404, "session_not_found", "セッションが見つかりません");
    }
    if (found.ownerId !== user.id) {
      return jsonError(c, 403, "not_owner", "主催者のみ招待リンクを再生成できます");
    }

    const inviteCode = newInviteCode();
    await db.update(sessions).set({ inviteCode }).where(eq(sessions.id, found.id));

    const body: SessionResponse = { session: toSessionDto({ ...found, inviteCode }, user.id) };
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

    const body: SessionResponse = { session: toSessionDto(ended, user.id) };
    return c.json(body);
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
    // 退出済みメンバーもここで弾かれる。
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

    // 開示済み位置。disclosure がまだ無ければ誰の位置も返さない。
    let disclosed: DisclosedLocation[] = [];
    if (disclosedAt !== null) {
      const memberRows = await findActiveMembers(db, session.id);
      const results = await Promise.all(
        memberRows.map(async (r) => {
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
      const memberRows = await findActiveMembers(db, session.id);

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
