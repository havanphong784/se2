import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

type Database = PostgresJsDatabase<typeof schema>;

let client: ReturnType<typeof postgres> | null = null;
let database: Database | null = null;

export function getDb(): Database | null {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return null;
  }

  if (!database) {
    const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
    client = postgres(connectionString, {
      ssl: isLocal ? false : "require",
      connect_timeout: 20,
    });
    database = drizzle(client, { schema });
  }

  return database;
}

export async function closeDb() {
  await client?.end();
  client = null;
  database = null;
}
