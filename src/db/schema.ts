import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/** Application users. Passwords are stored hashed (bcrypt). */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/**
 * A dream is the top-level "conversation". Each dream has a title,
 * the date the user dreamt it (dreamDate — may be backdated or null if
 * the user doesn't remember), plus AI-extracted metadata used for the
 * dashboard summary (mood + symbol tags).
 */
export const dreams = sqliteTable("dreams", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("حلم جديد"),
  // The date the dream happened (user-provided). Null = "لا أتذكر".
  dreamDate: integer("dream_date", { mode: "timestamp_ms" }),
  // AI-extracted overall mood: positive | neutral | negative | mixed
  mood: text("mood"),
  // JSON array of key symbol keys extracted from the dream.
  symbols: text("symbols"),
  // Final consolidated digest (markdown): the full dream + its final
  // interpretation, produced when the user "saves the summary" of a chat.
  summary: text("summary"),
  // Classification of the dream: "رؤيا" (true vision) | "أضغاث" (jumbled) |
  // "حديث نفس" (self-talk) | null if not classified.
  kind: text("kind"),
  // Public read-only share token (null = private).
  shareToken: text("share_token"),
  // Soft-delete timestamp (null = active, set = in trash).
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/** Individual chat turns inside a dream conversation. */
export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  dreamId: text("dream_id")
    .notNull()
    .references(() => dreams.id, { onDelete: "cascade" }),
  // "user" = the dreamer, "assistant" = the interpreter bot.
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export type User = typeof users.$inferSelect;
export type Dream = typeof dreams.$inferSelect;
export type Message = typeof messages.$inferSelect;

/**
 * Reader verdicts on an interpretation ("هل التفسير ظبط؟").
 *
 * Besides showing quality in the admin panel, each row snapshots the symbols
 * retrieval actually grounded that reply on — so ratings become a real eval
 * set: which retrieved symbols correlate with good interpretations.
 */
export const feedback = sqliteTable("feedback", {
  id: text("id").primaryKey(),
  messageId: text("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  dreamId: text("dream_id")
    .notNull()
    .references(() => dreams.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // "up" = التفسير ظبط، "down" = ما ظبطش
  rating: text("rating", { enum: ["up", "down"] }).notNull(),
  // Optional short reason, mostly for "down".
  reason: text("reason"),
  // JSON array of the symbols grounded for this reply, captured at rating time.
  symbols: text("symbols"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export type Feedback = typeof feedback.$inferSelect;
