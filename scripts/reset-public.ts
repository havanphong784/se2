import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const shouldReset = process.argv.includes("--reset");
const sql = postgres(connectionString, {
  ssl: "require",
  max: 1,
  connect_timeout: 20,
});

try {
  const tables = await sql<[{ table_name: string }]>`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `;
  const views = await sql<[{ table_name: string }]>`
    select table_name
    from information_schema.views
    where table_schema = 'public'
    order by table_name
  `;

  console.log(
    JSON.stringify({
      connected: true,
      mode: shouldReset ? "reset" : "inspect",
      publicTables: tables.map((row) => row.table_name),
      publicViews: views.map((row) => row.table_name),
    }),
  );

  if (shouldReset) {
    await sql.begin(async (transaction) => {
      await transaction.unsafe("drop schema public cascade");
      await transaction.unsafe("create schema public authorization postgres");
      await transaction.unsafe(
        "grant all on schema public to postgres, service_role",
      );
      await transaction.unsafe(
        "grant usage on schema public to anon, authenticated",
      );
      await transaction.unsafe(
        "alter default privileges for role postgres in schema public grant all on tables to postgres, service_role",
      );
      await transaction.unsafe(
        "alter default privileges for role postgres in schema public grant all on sequences to postgres, service_role",
      );
    });
    console.log("Public schema reset complete; Supabase managed schemas were untouched.");
  }
} finally {
  await sql.end();
}
