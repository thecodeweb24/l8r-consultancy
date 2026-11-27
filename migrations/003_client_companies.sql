BEGIN;

CREATE TABLE IF NOT EXISTS client_companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT NOT NULL DEFAULT '',
  website_url TEXT NOT NULL DEFAULT '',
  published SMALLINT NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD HH24:MI:SS'),
  updated_at TEXT NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD HH24:MI:SS')
);
CREATE INDEX IF NOT EXISTS client_companies_published_order_idx
  ON client_companies(published, sort_order, name);

COMMIT;
