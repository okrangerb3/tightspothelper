-- Add extended profile fields to auth_users
ALTER TABLE "auth_users"
  ADD COLUMN IF NOT EXISTS "firstName"  TEXT,
  ADD COLUMN IF NOT EXISTS "lastName"   TEXT,
  ADD COLUMN IF NOT EXISTS "city"       TEXT,
  ADD COLUMN IF NOT EXISTS "state"      TEXT,
  ADD COLUMN IF NOT EXISTS "zip"        TEXT;

-- Add public slug to expert_profiles (for /pro/[slug] pages)
ALTER TABLE "expert_profiles"
  ADD COLUMN IF NOT EXISTS "slug"        TEXT,
  ADD COLUMN IF NOT EXISTS "headline"    TEXT,
  ADD COLUMN IF NOT EXISTS "publicBio"   TEXT;

-- Unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS "expert_profiles_slug_key" ON "expert_profiles"("slug");

-- Backfill firstName/lastName from existing name field (best-effort split)
UPDATE "auth_users"
SET
  "firstName" = split_part("name", ' ', 1),
  "lastName"  = CASE
    WHEN strpos("name", ' ') > 0
    THEN substring("name" FROM strpos("name", ' ') + 1)
    ELSE NULL
  END
WHERE "firstName" IS NULL AND "name" IS NOT NULL AND "name" != '';
