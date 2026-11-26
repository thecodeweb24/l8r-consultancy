export function postgresSql(sql) {
  const ignored = /^\s*INSERT\s+OR\s+IGNORE\s+INTO/i.test(sql);
  let query = sql.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO');
  query = query
    .replace(/datetime\('now',\s*'\+8 hours'\)/gi, "to_char(CURRENT_TIMESTAMP + interval '8 hours', 'YYYY-MM-DD HH24:MI:SS')")
    .replace(/datetime\('now',\s*'-5 months'\)/gi, "(CURRENT_TIMESTAMP - interval '5 months')")
    .replace(/datetime\('now'\)/gi, "to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD HH24:MI:SS')")
    .replace(/strftime\('%Y-%m',\s*([^)]*)\)/gi, "to_char($1::timestamp, 'YYYY-MM')")
    .replace(/date\('now'\)/gi, 'CURRENT_DATE')
    .replace(/date\(([^)]+)\)/gi, "NULLIF($1, '')::date")
    .replace(/\bLIKE\b/gi, 'ILIKE');
  let index = 0;
  query = query.replace(/\?/g, () => `$${++index}`);
  if (ignored) query += ' ON CONFLICT DO NOTHING';
  return query;
}
