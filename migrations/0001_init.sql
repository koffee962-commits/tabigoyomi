-- 旅ごよみ: マイページのサーバー保存用スキーマ (Cloudflare D1)
--   npx wrangler d1 execute tabigoyomi-db --remote --file=./migrations/0001_init.sql
--   npx wrangler d1 execute tabigoyomi-db --local  --file=./migrations/0001_init.sql

-- ユーザー (Googleアカウントの sub で一意に識別する)
CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email      TEXT,
  name       TEXT,
  picture    TEXT,
  created_at INTEGER NOT NULL
);

-- セッション (id はCookieに入れるトークンのSHA-256。生のトークンは保存しない)
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- マイページのデータ (お気に入り・メモ・旅行計画をユーザー単位でJSONに格納)
CREATE TABLE IF NOT EXISTS user_data (
  user_id    TEXT PRIMARY KEY,
  json       TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
