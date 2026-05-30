CREATE TABLE IF NOT EXISTS "site_settings" (
  "key"       TEXT PRIMARY KEY,
  "value"     TEXT NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);
