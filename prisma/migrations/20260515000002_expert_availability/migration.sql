-- Add availability schedule, emergency rates, and custom specialties to expert_profiles

ALTER TABLE "expert_profiles"
  -- Weekly schedule: {"mon":{"on":true,"start":"08:00","end":"18:00"}, "tue":{...}, ...}
  ADD COLUMN IF NOT EXISTS "weeklySchedule"     JSONB,
  -- Emergency settings
  ADD COLUMN IF NOT EXISTS "emergencyAvailable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "emergencyRate"      DECIMAL(10,2),
  -- Custom specialty tags the pro adds themselves (free-form strings)
  ADD COLUMN IF NOT EXISTS "specialties"        TEXT[] DEFAULT '{}',
  -- Timezone for their schedule
  ADD COLUMN IF NOT EXISTS "timezone"           TEXT DEFAULT 'America/Chicago';
