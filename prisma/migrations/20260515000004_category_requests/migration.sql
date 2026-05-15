CREATE TABLE IF NOT EXISTS "category_requests" (
  "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"       TEXT NOT NULL REFERENCES "auth_users"("id") ON DELETE CASCADE,
  "categoryName" TEXT NOT NULL,
  "description"  TEXT,
  "status"       TEXT NOT NULL DEFAULT 'pending',
  "adminNote"    TEXT,
  "createdAt"    TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "category_requests_status_idx" ON "category_requests"("status");
