ALTER TABLE "category_requests"
  ADD COLUMN IF NOT EXISTS "requestedBy" TEXT NOT NULL DEFAULT 'customer';
