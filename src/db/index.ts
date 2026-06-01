import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const url = process.env.DATABASE_URL || "file:local.db";
const authToken = process.env.DATABASE_AUTH_TOKEN || undefined;

// A single libSQL client is reused across hot reloads / serverless
// invocations to avoid exhausting connections.
const globalForDb = globalThis as unknown as {
  __libsqlClient?: ReturnType<typeof createClient>;
};

const client =
  globalForDb.__libsqlClient ?? createClient({ url, authToken });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__libsqlClient = client;
}

export const db = drizzle(client, { schema });
export { schema };
