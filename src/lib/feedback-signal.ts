import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  penalty,
  symbolKey,
  type SymbolVerdicts,
} from "./feedback-penalty";

export { penalty, symbolKey, type SymbolVerdicts } from "./feedback-penalty";

/**
 * Turns reader verdicts into a retrieval signal.
 *
 * Every rating snapshots the symbols that were grounded for that reply, so a
 * symbol which keeps showing up under rejected interpretations is evidence
 * that retrieving it misleads the interpreter. We demote those rather than
 * drop them: the rating is about the whole answer, not that one symbol, so
 * this is a nudge in ranking and never a ban.
 */

const CACHE_MS = 5 * 60_000;
let cache: { at: number; map: Map<string, SymbolVerdicts> } | null = null;
let inflight: Promise<Map<string, SymbolVerdicts>> | null = null;

async function load(): Promise<Map<string, SymbolVerdicts>> {
  const map = new Map<string, SymbolVerdicts>();
  const rows = await db
    .select({ rating: schema.feedback.rating, symbols: schema.feedback.symbols })
    .from(schema.feedback)
    .where(sql`${schema.feedback.symbols} is not null`);

  for (const row of rows) {
    let symbols: unknown;
    try {
      symbols = JSON.parse(row.symbols ?? "[]");
    } catch {
      continue;
    }
    if (!Array.isArray(symbols)) continue;
    for (const s of symbols) {
      if (typeof s !== "string") continue;
      const key = symbolKey(s);
      if (!key) continue;
      const cur = map.get(key) ?? { up: 0, down: 0 };
      if (row.rating === "up") cur.up++;
      else cur.down++;
      map.set(key, cur);
    }
  }
  return map;
}

/**
 * Cached per warm instance. Ratings move slowly, and retrieval runs on every
 * interpretation — re-querying each time would add a database round trip to
 * the critical path for a signal that barely changes.
 */
export async function symbolVerdicts(): Promise<Map<string, SymbolVerdicts>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.map;
  if (inflight) return inflight;
  inflight = load()
    .then((map) => {
      cache = { at: Date.now(), map };
      return map;
    })
    .catch((e) => {
      console.error("[feedback] could not load verdicts:", (e as Error)?.message);
      return cache?.map ?? new Map<string, SymbolVerdicts>();
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Drop the cache so the next retrieval reflects a rating just recorded. */
export function invalidateVerdicts(): void {
  cache = null;
}
