-- Notification preferences per user
CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"      TEXT NOT NULL REFERENCES "auth_users"("id") ON DELETE CASCADE,
  -- Email notifications
  "emailSessionConfirm"   BOOLEAN NOT NULL DEFAULT true,
  "emailSessionReminder"  BOOLEAN NOT NULL DEFAULT true,
  "emailSessionSummary"   BOOLEAN NOT NULL DEFAULT true,
  "emailNewBooking"       BOOLEAN NOT NULL DEFAULT true,
  "emailPayoutReleased"   BOOLEAN NOT NULL DEFAULT true,
  "emailRecordingReady"   BOOLEAN NOT NULL DEFAULT true,
  "emailRecordingExpiry"  BOOLEAN NOT NULL DEFAULT true,
  "emailMarketing"        BOOLEAN NOT NULL DEFAULT false,
  -- Push / in-app
  "pushSessionAlert"      BOOLEAN NOT NULL DEFAULT true,
  "pushNewBooking"        BOOLEAN NOT NULL DEFAULT true,
  "pushEmergencyRequest"  BOOLEAN NOT NULL DEFAULT true,
  "pushPayoutReleased"    BOOLEAN NOT NULL DEFAULT true,
  -- Admin override — null means user controls it, true/false forces it
  "adminOverrideEmail"    BOOLEAN,
  "adminOverridePush"     BOOLEAN,
  "adminNote"             TEXT,
  "updatedAt"             TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE("userId")
);

-- Auto-create preferences row on new user
CREATE OR REPLACE FUNCTION create_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_preferences ("userId") VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_user_created_notification_prefs ON auth_users;
CREATE TRIGGER on_user_created_notification_prefs
  AFTER INSERT ON auth_users
  FOR EACH ROW EXECUTE FUNCTION create_notification_preferences();

-- Backfill existing users
INSERT INTO notification_preferences ("userId")
SELECT id FROM auth_users
ON CONFLICT DO NOTHING;
