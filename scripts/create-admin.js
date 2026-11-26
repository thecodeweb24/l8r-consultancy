import crypto from 'node:crypto';
import pg from 'pg';
import { getDatabaseUrl } from '../lib/database-config.js';

let databaseUrl;
try {
  databaseUrl = getDatabaseUrl();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';
const name = (process.env.ADMIN_NAME || 'Moksh Patel').trim();

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Set ADMIN_EMAIL to a valid email address in .env.local or the process environment.');
  process.exit(1);
}
if (password.length < 12) {
  console.error('Set ADMIN_PASSWORD to a strong password of at least 12 characters.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED === 'true' },
  max: 1,
  connectionTimeoutMillis: 10_000
});

try {
  const schema = await pool.query("SELECT to_regclass('public.users') AS users");
  if (!schema.rows[0].users) {
    throw new Error('Supabase schema is not installed. Run migrations/001_initial_schema.sql in the Supabase SQL Editor.');
  }
  const existing = await pool.query("SELECT id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1");
  if (existing.rowCount) {
    console.error('A super admin already exists; refusing to create another one.');
    process.exitCode = 1;
  } else {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    await pool.query(
      'INSERT INTO users (id,name,email,role,password_salt,password_hash) VALUES ($1,$2,$3,$4,$5,$6)',
      [`user-${crypto.randomUUID()}`, name, email, 'SUPER_ADMIN', salt, hash]
    );
    console.log('Created the initial super admin account.');
  }
} catch (error) {
  if (error.code === '23505') {
    console.error('An account already uses this email address.');
    process.exitCode = 1;
  } else {
    console.error(error.message);
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}
