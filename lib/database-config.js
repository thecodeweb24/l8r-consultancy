export function getDatabaseUrl(environment = process.env) {
  const value = environment.DATABASE_URL?.trim();
  if (!value) {
    throw new Error('DATABASE_URL is required. Set your Supabase PostgreSQL connection URI in .env.local.');
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URI.');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URI (postgres:// or postgresql://), not the Supabase HTTPS API URL.');
  }

  return value;
}
