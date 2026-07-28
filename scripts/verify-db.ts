import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const sql = postgres(connectionString, {
  ssl: "require",
  max: 1,
  connect_timeout: 20,
});

try {
  const counts = await sql<{ table_name: string; row_count: number }[]>`
    select 'users' as table_name, count(*)::int as row_count from public.users
    union all select 'decks', count(*)::int from public.decks
    union all select 'words', count(*)::int from public.words
    union all select 'word_progress', count(*)::int from public.word_progress
    union all select 'study_sessions', count(*)::int from public.study_sessions
    union all select 'daily_activity', count(*)::int from public.daily_activity
    order by table_name
  `;
  const security = await sql<
    { table_name: string; rls_enabled: boolean; anon_can_select: boolean }[]
  >`
    select
      c.relname as table_name,
      c.relrowsecurity as rls_enabled,
      has_table_privilege('anon', format('%I.%I', n.nspname, c.relname), 'select') as anon_can_select
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  `;
  const managedSchemas = await sql<{ schema_name: string }[]>`
    select schema_name
    from information_schema.schemata
    where schema_name in ('auth', 'storage', 'realtime', 'extensions')
    order by schema_name
  `;

  console.log(
    JSON.stringify(
      {
        counts,
        security,
        managedSchemas: managedSchemas.map((row) => row.schema_name),
      },
      null,
      2,
    ),
  );
} finally {
  await sql.end();
}
