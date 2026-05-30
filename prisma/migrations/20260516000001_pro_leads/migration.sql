CREATE TABLE IF NOT EXISTS "pro_leads" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessName"    TEXT NOT NULL,
  "phone"           TEXT NOT NULL,
  "address"         TEXT,
  "lat"             DOUBLE PRECISION,
  "lng"             DOUBLE PRECISION,
  "googlePlaceId"   TEXT UNIQUE,
  "googleRating"    DOUBLE PRECISION,
  "categoryId"      TEXT NOT NULL,
  "categoryName"    TEXT NOT NULL,
  "inviteCode"      TEXT NOT NULL UNIQUE,
  "source"          TEXT NOT NULL DEFAULT 'google_places',
  "status"          TEXT NOT NULL DEFAULT 'discovered',
  "discoveredById"  TEXT,
  "lastContactedAt" TIMESTAMP,
  "clickedAt"       TIMESTAMP,
  "registeredAt"    TIMESTAMP,
  "registeredUserId" TEXT,
  "createdAt"       TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "pro_outreach" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "proLeadId"   TEXT NOT NULL REFERENCES "pro_leads"("id") ON DELETE CASCADE,
  "channel"     TEXT NOT NULL DEFAULT 'sms',
  "twilioSid"   TEXT,
  "status"      TEXT NOT NULL DEFAULT 'pending',
  "messageBody" TEXT,
  "error"       TEXT,
  "createdAt"   TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "pro_leads_category_idx" ON "pro_leads"("categoryId");
CREATE INDEX IF NOT EXISTS "pro_leads_status_idx" ON "pro_leads"("status");
CREATE INDEX IF NOT EXISTS "pro_leads_invite_idx" ON "pro_leads"("inviteCode");
