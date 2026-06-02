import "server-only";
import { desc, eq, inArray, sql } from "drizzle-orm";
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
