import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
const sql = postgres(connectionString, {
  ssl: isLocal ? false : "require",
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
  const [{ hasAnon }] = await sql<{ hasAnon: boolean }[]>`
    select exists(select 1 from pg_roles where rolname = 'anon') as "hasAnon"
  `;
  const security = await sql<
    { table_name: string; rls_enabled: boolean; anon_can_select: boolean | null }[]
  >`
    select
      c.relname as table_name,
      c.relrowsecurity as rls_enabled,
      case when ${hasAnon} then has_table_privilege('anon', format('%I.%I', n.nspname, c.relname), 'select') else null end as anon_can_select
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
  const [ownership] = await sql<
    { system_decks: number; owned_decks: number; orphaned_decks: number }[]
  >`
    select
      count(*) filter (where d.owner_id is null)::int as system_decks,
      count(*) filter (where d.owner_id is not null)::int as owned_decks,
      count(*) filter (where d.owner_id is not null and u.id is null)::int as orphaned_decks
    from public.decks d
    left join public.users u on u.id = d.owner_id
  `;

  console.log(
    JSON.stringify(
      {
        counts,
        ownership,
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
