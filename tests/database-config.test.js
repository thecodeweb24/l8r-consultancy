import test from 'node:test';
import assert from 'node:assert/strict';
import { getDatabaseUrl } from '../lib/database-config.js';

test('accepts a PostgreSQL connection URI', () => {
  const value = 'postgresql://postgres:secret@db.example.com:5432/postgres';
  assert.equal(getDatabaseUrl({ DATABASE_URL: value }), value);
});

test('rejects a Supabase HTTPS API URL with actionable guidance', () => {
  assert.throws(
    () => getDatabaseUrl({ DATABASE_URL: 'https://example.supabase.co' }),
    /PostgreSQL connection URI.*not the Supabase HTTPS API URL/
  );
});

test('rejects missing database URL', () => {
  assert.throws(() => getDatabaseUrl({}), /DATABASE_URL is required/);
});
