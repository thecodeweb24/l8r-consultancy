import assert from 'node:assert/strict';
import test from 'node:test';
import { postgresSql } from '../lib/postgres-sql.js';

test('converts positional SQLite placeholders to PostgreSQL parameters', () => {
  assert.equal(postgresSql('SELECT * FROM users WHERE id = ? AND email = ?'), 'SELECT * FROM users WHERE id = $1 AND email = $2');
});

test('converts SQLite date and time expressions', () => {
  assert.equal(
    postgresSql("SELECT datetime('now'), datetime('now', '+8 hours'), date(l.follow_up_at), date('now')"),
    "SELECT to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD HH24:MI:SS'), to_char(CURRENT_TIMESTAMP + interval '8 hours', 'YYYY-MM-DD HH24:MI:SS'), NULLIF(l.follow_up_at, '')::date, CURRENT_DATE"
  );
  assert.equal(
    postgresSql("SELECT strftime('%Y-%m', l.created_at)"),
    "SELECT to_char(l.created_at::timestamp, 'YYYY-MM')"
  );
});

test('translates SQLite ignore and case-insensitive search syntax', () => {
  assert.equal(
    postgresSql('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'),
    'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT DO NOTHING'
  );
  assert.equal(postgresSql('SELECT * FROM leads WHERE email LIKE ?'), 'SELECT * FROM leads WHERE email ILIKE $1');
});
