import "server-only";
import { desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";

// Admin-only data access: spans ALL users (unlike lib/dreams.ts which is
// always scoped to the session user). Guard every caller with getAdminSession().

/** All users with their dream counts, newest first. */
export async function listAllUsers() {
  return db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      createdAt: schema.users.createdAt,
      dreamCount: sql<number>`count(${schema.dreams.id})`,
    })
    .from(schema.users)
    .leftJoin(schema.dreams, eq(schema.dreams.userId, schema.users.id))
    .groupBy(schema.users.id)
    .orderBy(desc(schema.users.createdAt));
}

/** Every dream of a given user (including trashed), newest first. */
export async function listUserDreams(userId: string) {
  return db
    .select()
    .from(schema.dreams)
    .where(eq(schema.dreams.userId, userId))
    .orderBy(desc(schema.dreams.createdAt));
}

/** A dream (any owner) plus its owner and full message thread. */
export async function getDreamForAdmin(dreamId: string) {
  const dream = (
    await db
      .select()
      .from(schema.dreams)
      .where(eq(schema.dreams.id, dreamId))
      .limit(1)
  )[0];
  if (!dream) return null;

  const owner = (
    await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
      })
      .from(schema.users)
      .where(eq(schema.users.id, dream.userId))
      .limit(1)
  )[0];

  const messages = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.dreamId, dreamId))
    .orderBy(schema.messages.createdAt);

  return { dream, owner, messages };
}

/** Hard-delete a dream and its messages (FK cascade isn't guaranteed on libSQL). */
export async function deleteDreamAsAdmin(dreamId: string) {
  await db.delete(schema.messages).where(eq(schema.messages.dreamId, dreamId));
  await db.delete(schema.dreams).where(eq(schema.dreams.id, dreamId));
}

/** Aggregate statistics across the whole app for the admin dashboard. */
export async function getAdminStats() {
  const n = (rows: { n: number }[]) => Number(rows[0]?.n ?? 0);

  const totalUsers = n(
    await db.select({ n: sql<number>`count(*)` }).from(schema.users),
  );
  const totalDreams = n(
    await db.select({ n: sql<number>`count(*)` }).from(schema.dreams),
  );
  const activeDreams = n(
    await db
      .select({ n: sql<number>`count(*)` })
      .from(schema.dreams)
      .where(isNull(schema.dreams.deletedAt)),
  );
  const totalMessages = n(
    await db.select({ n: sql<number>`count(*)` }).from(schema.messages),
  );
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const recentSignups = n(
    await db
      .select({ n: sql<number>`count(*)` })
      .from(schema.users)
      .where(gte(schema.users.createdAt, weekAgo)),
  );

  const byMood = await db
    .select({ key: schema.dreams.mood, count: sql<number>`count(*)` })
    .from(schema.dreams)
    .groupBy(schema.dreams.mood);
  const byKind = await db
    .select({ key: schema.dreams.kind, count: sql<number>`count(*)` })
    .from(schema.dreams)
    .groupBy(schema.dreams.kind);

  // Top symbols: parse the per-dream symbols JSON arrays and tally.
  const symbolRows = await db
    .select({ symbols: schema.dreams.symbols })
    .from(schema.dreams);
  const tally = new Map<string, number>();
  for (const r of symbolRows) {
    if (!r.symbols) continue;
    try {
      for (const s of JSON.parse(r.symbols) as string[])
        tally.set(s, (tally.get(s) || 0) + 1);
    } catch {
      /* ignore malformed */
    }
  }
  const topSymbols = [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([symbol, count]) => ({ symbol, count }));

  return {
    totals: { totalUsers, totalDreams, activeDreams, totalMessages, recentSignups },
    byMood: byMood.map((r) => ({ key: r.key, count: Number(r.count) })),
    byKind: byKind.map((r) => ({ key: r.key, count: Number(r.count) })),
    topSymbols,
  };
}

/** Full data export (passwords excluded). */
export async function exportAllData() {
  const users = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users);
  const dreams = await db.select().from(schema.dreams);
  const messages = await db.select().from(schema.messages);
  return { exportedAt: new Date().toISOString(), users, dreams, messages };
}

/** Hard-delete a user with all their dreams and messages. */
export async function deleteUserAsAdmin(userId: string) {
  const dreams = await db
    .select({ id: schema.dreams.id })
    .from(schema.dreams)
    .where(eq(schema.dreams.userId, userId));
  const ids = dreams.map((d) => d.id);
  if (ids.length) {
    await db.delete(schema.messages).where(inArray(schema.messages.dreamId, ids));
  }
  await db.delete(schema.dreams).where(eq(schema.dreams.userId, userId));
  await db.delete(schema.users).where(eq(schema.users.id, userId));
}
