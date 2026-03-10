-- Comments & Likes System - Initial Migration
-- Run this against your PlanetScale PostgreSQL database
-- or use `drizzle-kit push` to apply schema directly

CREATE TYPE vote_type AS ENUM ('up', 'down');

CREATE TABLE IF NOT EXISTS comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url         TEXT NOT NULL,
  username    TEXT NOT NULL DEFAULT 'Anonymous',
  password_hash TEXT NOT NULL,
  text        TEXT NOT NULL,
  ip_hash     TEXT NOT NULL,
  reply       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS comments_url_idx ON comments (url);
CREATE INDEX IF NOT EXISTS comments_ip_hash_idx ON comments (ip_hash);

CREATE TABLE IF NOT EXISTS comment_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id  UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  ip_hash     TEXT NOT NULL,
  vote_type   vote_type NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT comment_votes_unique UNIQUE (comment_id, ip_hash)
);

CREATE TABLE IF NOT EXISTS likes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url         TEXT NOT NULL,
  ip_hash     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT likes_unique UNIQUE (url, ip_hash)
);

CREATE INDEX IF NOT EXISTS likes_url_idx ON likes (url);

CREATE TABLE IF NOT EXISTS banned_ips (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash     TEXT NOT NULL UNIQUE,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
