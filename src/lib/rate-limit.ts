import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Per-user cap on interpretation requests.
 *
 * Every interpretation spends a slice of a shared, rate-limited AI quota, so
 * one signed-in account looping the compose box can starve everyone else.
 *
 * The count comes from the messages table rather than in-memory state: each
 * serverless instance has its own memory and they are recycled constantly, so
 * anything held in a module variable would reset and let the cap be walked
 * straight through.
 */

const PER_HOUR = () => Number(process.env.AI_RATE_LIMIT_PER_HOUR) || 30;
const HOUR_MS = 60 * 60_000;

export interface RateVerdict {
  allowed: boolean;
  used: number;
  limit: number;
  /** Seconds until the oldest request in the window ages out. */
  retryAfter: number;
}

export async function checkInterpretationQuota(
  userId: string,
): Promise<RateVerdict> {
  const limit = PER_HOUR();
  if (limit <= 0) {
    return { allowed: true, used: 0, limit: 0, retryAfter: 0 };
  }

  const since = new Date(Date.now() - HOUR_MS);
  const rows = await db
    .select({
      n: sql<number>`count(*)`,
      oldest: sql<number>`min(${schema.messages.createdAt})`,
    })
    .from(schema.messages)
    .innerJoin(schema.dreams, eq(schema.messages.dreamId, schema.dreams.id))
    .where(
      and(
        eq(schema.dreams.userId, userId),
        eq(schema.messages.role, "user"),
        gte(schema.messages.createdAt, since),
      ),
    );

  const used = Number(rows[0]?.n ?? 0);
  const oldest = Number(rows[0]?.oldest ?? 0);
  const retryAfter = oldest
    ? Math.max(1, Math.ceil((oldest + HOUR_MS - Date.now()) / 1000))
    : 0;

  return { allowed: used < limit, used, limit, retryAfter };
}

/** Arabic message telling the reader when they can try again. */
export function quotaMessage(v: RateVerdict): string {
  const minutes = Math.max(1, Math.ceil(v.retryAfter / 60));
  return (
    `وصلتَ إلى الحدّ المسموح به (${v.limit} تفسيراً في الساعة). ` +
    `جرّب بعد ${minutes} دقيقة تقريباً.`
  );
}
