import { createClient } from "@libsql/client";

/**
 * Idempotently create all tables. Safe to call on every cold start —
 * uses CREATE TABLE IF NOT EXISTS so it never destroys data. This keeps
 * the app zero-config: no separate migration step is required to deploy.
 */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE TABLE IF NOT EXISTS dreams (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'حلم جديد',
    dream_date INTEGER,
    mood TEXT,
    symbols TEXT,
    summary TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    dream_id TEXT NOT NULL REFERENCES dreams(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_dreams_user ON dreams(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_dream ON messages(dream_id)`,
];

// Additive column migrations for databases created before a column existed.
// SQLite has no "ADD COLUMN IF NOT EXISTS", so we attempt each and ignore the
// "duplicate column name" error when it's already there.
const ADD_COLUMNS = [
  "ALTER TABLE dreams ADD COLUMN summary TEXT",
];

let initialized: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!initialized) {
    const client = createClient({
      url: process.env.DATABASE_URL || "file:local.db",
      authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
    });
    initialized = client
      .batch(STATEMENTS, "write")
      .then(async () => {
        for (const sql of ADD_COLUMNS) {
          try {
            await client.execute(sql);
          } catch (e) {
            // Ignore "duplicate column" — the column already exists.
            if (!String(e).includes("duplicate column")) throw e;
          }
        }
      })
      .then(() => undefined);
  }
  return initialized;
}
