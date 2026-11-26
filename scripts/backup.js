import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Set it in .env.local or the process environment.');
  process.exit(1);
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));
const backups = path.join(dataDir, 'backups');
fs.mkdirSync(backups, { recursive: true });

let connection;
try {
  connection = new URL(process.env.DATABASE_URL);
} catch {
  console.error('DATABASE_URL is not a valid PostgreSQL connection URL.');
  process.exit(1);
}
const database = decodeURIComponent(connection.pathname.replace(/^\/+/, ''));
if (!database || !connection.hostname || !connection.username) {
  console.error('DATABASE_URL must include a PostgreSQL host, database name, and username.');
  process.exit(1);
}

const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const target = path.join(backups, `l8r-${timestamp}`);
fs.mkdirSync(target, { recursive: true });
const dumpPath = path.join(target, 'postgres.dump');
const baseEnv = { ...process.env };
delete baseEnv.DATABASE_URL;
const env = {
  ...baseEnv,
  PGPASSWORD: decodeURIComponent(connection.password),
  PGSSLMODE: process.env.PGSSLMODE || (process.env.PGSSL === 'disable' ? 'disable' : 'require')
};
const args = [
  '--host', connection.hostname,
  '--port', connection.port || '5432',
  '--username', decodeURIComponent(connection.username),
  '--dbname', database,
  '--no-password',
  '--no-owner',
  '--no-privileges',
  '--format=custom',
  `--file=${dumpPath}`
];
const dump = spawnSync('pg_dump', args, { stdio: 'inherit', env, windowsHide: true });
if (dump.error || dump.status !== 0) {
  fs.rmSync(target, { recursive: true, force: true });
  if (dump.error?.code === 'ENOENT') {
    console.error('pg_dump was not found. Install PostgreSQL client tools and add pg_dump to PATH.');
  } else {
    console.error('PostgreSQL logical backup failed. Use a direct or session-pooled Supabase connection.');
  }
  process.exit(1);
}

const uploads = path.join(dataDir, 'uploads');
if (fs.existsSync(uploads)) fs.cpSync(uploads, path.join(target, 'uploads'), { recursive: true, errorOnExist: true });
console.log(`PostgreSQL logical dump and local upload backup created: ${target}`);
