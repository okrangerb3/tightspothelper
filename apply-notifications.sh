#!/usr/bin/env bash
# Fix email verification + add notification preferences
set -e
if [ ! -f package.json ] || ! grep -q "tightspothelper" package.json 2>/dev/null; then
  echo "⚠️  Run from the repo root." >&2; exit 1
fi

mkdir -p \
  prisma/migrations/20260515000003_notification_preferences \
  app/api/notifications/preferences \
  app/api/admin/notifications \
  "app/(customer)/customer/notifications" \
  "app/(expert)/expert/notifications" \
  components/admin

echo '→ writing lib/auth.ts'
cat > 'lib/auth.ts' << 'TSH_EOF_MARKER'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from './db'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

if (!process.env.DATABASE_URL) {
  console.error('[Auth] DATABASE_URL is not set.')
}

const isProd          = process.env.NODE_ENV === 'production'
const canonicalAppUrl = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://tightspothelper.com'
const FROM            = process.env.RESEND_FROM_EMAIL ?? 'noreply@tightspothelper.com'

const authBaseURL = isProd
  ? { allowedHosts: ['tightspothelper.com','www.tightspothelper.com','*.vercel.app','*.railway.app'], protocol: 'https' as const, fallback: canonicalAppUrl }
  : { allowedHosts: ['localhost:*','127.0.0.1:*'], protocol: 'http' as const, fallback: 'http://localhost:3000' }

const authSecret = process.env.BETTER_AUTH_SECRET || (isProd ? undefined : 'tightspothelper-local-dev-secret-change-before-prod')

function verificationEmailHtml(url: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <!-- Logo -->
        <tr><td style="padding-bottom:32px;text-align:center;">
          <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
            TightSpot<span style="color:#f97c0a;">Helper</span>
          </span>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#18181b;border:1px solid #27272a;border-radius:16px;padding:40px 32px;">
          <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#ffffff;">Verify your email</h1>
          <p style="margin:0 0 28px;font-size:15px;color:#a1a1aa;line-height:1.6;">
            Click the button below to verify your email address and activate your TightSpotHelper account.
            This link expires in <strong style="color:#ffffff;">24 hours</strong>.
          </p>
          <a href="${url}"
            style="display:inline-block;background:#f97c0a;color:#ffffff;font-size:15px;font-weight:600;
                   text-decoration:none;padding:14px 32px;border-radius:12px;">
            Verify my email →
          </a>
          <p style="margin:28px 0 0;font-size:12px;color:#52525b;">
            Or copy and paste this link:<br>
            <a href="${url}" style="color:#f97c0a;word-break:break-all;">${url}</a>
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:24px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#3f3f46;">
            If you didn't create an account, you can safely ignore this email.<br>
            © ${new Date().getFullYear()} TightSpotHelper
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export const auth = betterAuth({
  secret:   authSecret,
  baseURL:  authBaseURL,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  session: {
    modelName:  'AuthSession',
    expiresIn:  60 * 60 * 12,
    updateAge:  60 * 60,
    freshAge:   60 * 15,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },

  user: {
    modelName: 'AuthUser',
    additionalFields: {
      role:             { type: 'string', defaultValue: 'customer', required: false, input: true },
      phone:            { type: 'string', required: false, input: true },
      stripeCustomerId: { type: 'string', required: false, input: false },
    },
  },
  account:      { modelName: 'AuthAccount' },
  verification: { modelName: 'AuthVerification' },

  emailAndPassword: {
    enabled:                  true,
    requireEmailVerification: true,
    minPasswordLength:        8,
  },

  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      const result = await resend.emails.send({
        from:    FROM,
        to:      user.email,
        subject: 'Verify your TightSpotHelper email',
        html:    verificationEmailHtml(url),
      })
      if (result.error) {
        console.error('[Auth] Failed to send verification email:', result.error)
      }
    },
  },

  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID ? {
      google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET! },
    } : {}),
    ...(process.env.APPLE_CLIENT_ID ? {
      apple: { clientId: process.env.APPLE_CLIENT_ID, clientSecret: process.env.APPLE_CLIENT_SECRET! },
    } : {}),
  },
})
TSH_EOF_MARKER

echo '→ writing prisma/migrations/20260515000003_notification_preferences/migration.sql'
cat > 'prisma/migrations/20260515000003_notification_preferences/migration.sql' << 'TSH_EOF_MARKER'
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
TSH_EOF_MARKER

echo '→ writing app/api/notifications/preferences/route.ts'
cat > 'app/api/notifications/preferences/route.ts' << 'TSH_EOF_MARKER'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

const DEFAULTS = {
  emailSessionConfirm: true, emailSessionReminder: true,
  emailSessionSummary: true, emailNewBooking: true,
  emailPayoutReleased: true, emailRecordingReady: true,
  emailRecordingExpiry: true, emailMarketing: false,
  pushSessionAlert: true, pushNewBooking: true,
  pushEmergencyRequest: true, pushPayoutReleased: true,
}

export async function GET(_req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const prefs = await (prisma as any).notificationPreferences.findUnique({
    where: { userId: session.user.id },
  })
  return NextResponse.json(prefs ?? { ...DEFAULTS, adminOverrideEmail: null, adminOverridePush: null })
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const body = await req.json()
  const { adminOverrideEmail, adminOverridePush, adminNote, userId, id, updatedAt, ...safe } = body

  await (prisma as any).notificationPreferences.upsert({
    where:  { userId: session.user.id },
    create: { userId: session.user.id, ...safe },
    update: { ...safe, updatedAt: new Date() },
  })
  return NextResponse.json({ ok: true })
}
TSH_EOF_MARKER

echo '→ writing app/api/admin/notifications/route.ts'
cat > 'app/api/admin/notifications/route.ts' << 'TSH_EOF_MARKER'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if ((session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const userId = new URL(req.url).searchParams.get('userId')
  const prefs  = await (prisma as any).notificationPreferences.findUnique({ where: { userId: userId ?? '' } })
  return NextResponse.json({ prefs })
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if ((session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, adminOverrideEmail, adminOverridePush, adminNote } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  await (prisma as any).notificationPreferences.upsert({
    where:  { userId },
    create: { userId, adminOverrideEmail, adminOverridePush, adminNote },
    update: { adminOverrideEmail, adminOverridePush, adminNote, updatedAt: new Date() },
  })
  return NextResponse.json({ ok: true })
}
TSH_EOF_MARKER

echo '→ writing app/(customer)/customer/notifications/page.tsx'
cat > 'app/(customer)/customer/notifications/page.tsx' << 'TSH_EOF_MARKER'
'use client'

import { useState, useEffect } from 'react'

interface Prefs {
  emailSessionConfirm:  boolean
  emailSessionReminder: boolean
  emailSessionSummary:  boolean
  emailNewBooking:      boolean
  emailPayoutReleased:  boolean
  emailRecordingReady:  boolean
  emailRecordingExpiry: boolean
  emailMarketing:       boolean
  pushSessionAlert:     boolean
  pushNewBooking:       boolean
  pushEmergencyRequest: boolean
  pushPayoutReleased:   boolean
  adminOverrideEmail:   boolean | null
  adminOverridePush:    boolean | null
}

const EMAIL_SETTINGS = [
  { key: 'emailSessionConfirm',  label: 'Session confirmation',     desc: 'When a session is booked' },
  { key: 'emailSessionReminder', label: 'Session reminders',        desc: '1 hour before your session' },
  { key: 'emailSessionSummary',  label: 'Session summary',          desc: 'Notes, parts, and receipt after each session' },
  { key: 'emailNewBooking',      label: 'New booking (experts)',     desc: 'When a customer books you' },
  { key: 'emailPayoutReleased',  label: 'Payout released',          desc: 'When earnings are sent to your account' },
  { key: 'emailRecordingReady',  label: 'Recording ready',          desc: 'When your session recording is available' },
  { key: 'emailRecordingExpiry', label: 'Recording expiry warning', desc: '5 days before a recording expires' },
  { key: 'emailMarketing',       label: 'Tips & updates',           desc: 'Product news, tips, and promotions' },
] as const

const PUSH_SETTINGS = [
  { key: 'pushSessionAlert',     label: 'Session alerts',     desc: 'Reminders and status changes' },
  { key: 'pushNewBooking',       label: 'New bookings',       desc: 'Customer booked a session with you' },
  { key: 'pushEmergencyRequest', label: 'Emergency requests', desc: 'Urgent after-hours booking requests' },
  { key: 'pushPayoutReleased',   label: 'Payout released',    desc: 'Earnings sent to your account' },
] as const

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button onClick={onChange} disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0
        ${on ? 'bg-brand-500' : 'bg-ink-700'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform
        ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

export default function NotificationsPage() {
  const [prefs, setPrefs]   = useState<Prefs | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/notifications/preferences')
      .then(r => r.json())
      .then(d => { setPrefs(d); setLoading(false) })
  }, [])

  const toggle = (key: keyof Prefs) => {
    setPrefs(p => p ? { ...p, [key]: !p[key as keyof Prefs] } : p)
  }

  const save = async () => {
    if (!prefs) return
    setSaving(true)
    await fetch('/api/notifications/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return (
    <div className="p-6 space-y-3">
      {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-ink-800 rounded-xl animate-pulse" />)}
    </div>
  )

  if (!prefs) return null

  const emailLocked = prefs.adminOverrideEmail !== null && prefs.adminOverrideEmail !== undefined
  const pushLocked  = prefs.adminOverridePush  !== null && prefs.adminOverridePush  !== undefined

  return (
    <div className="p-4 sm:p-8 max-w-xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-white">Notifications</h1>
        <button onClick={save} disabled={saving}
          className={`btn-primary text-sm ${saved ? 'bg-green-600' : ''}`}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      {/* Admin override banners */}
      {emailLocked && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-4 text-xs text-yellow-400">
          ⚠️ Email notifications have been {prefs.adminOverrideEmail ? 'enabled' : 'disabled'} by an administrator.
        </div>
      )}
      {pushLocked && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-4 text-xs text-yellow-400">
          ⚠️ Push notifications have been {prefs.adminOverridePush ? 'enabled' : 'disabled'} by an administrator.
        </div>
      )}

      {/* Email */}
      <div className="card overflow-hidden mb-5">
        <div className="px-5 py-4 border-b border-ink-800 flex items-center gap-3">
          <span className="text-base">📧</span>
          <div>
            <h2 className="text-sm font-bold text-white">Email notifications</h2>
            {emailLocked && <p className="text-[10px] text-ink-500">Managed by admin</p>}
          </div>
        </div>
        <div className="divide-y divide-ink-800/60">
          {EMAIL_SETTINGS.map(s => (
            <div key={s.key} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">{s.label}</p>
                <p className="text-xs text-ink-500">{s.desc}</p>
              </div>
              <Toggle
                on={emailLocked ? !!prefs.adminOverrideEmail : !!prefs[s.key as keyof Prefs]}
                onChange={() => !emailLocked && toggle(s.key as keyof Prefs)}
                disabled={emailLocked}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Push */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-ink-800 flex items-center gap-3">
          <span className="text-base">🔔</span>
          <div>
            <h2 className="text-sm font-bold text-white">Push &amp; in-app notifications</h2>
            {pushLocked && <p className="text-[10px] text-ink-500">Managed by admin</p>}
          </div>
        </div>
        <div className="divide-y divide-ink-800/60">
          {PUSH_SETTINGS.map(s => (
            <div key={s.key} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">{s.label}</p>
                <p className="text-xs text-ink-500">{s.desc}</p>
              </div>
              <Toggle
                on={pushLocked ? !!prefs.adminOverridePush : !!prefs[s.key as keyof Prefs]}
                onChange={() => !pushLocked && toggle(s.key as keyof Prefs)}
                disabled={pushLocked}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
TSH_EOF_MARKER

echo '→ writing app/(expert)/expert/notifications/page.tsx'
cat > 'app/(expert)/expert/notifications/page.tsx' << 'TSH_EOF_MARKER'
'use client'

import { useState, useEffect } from 'react'

interface Prefs {
  emailSessionConfirm:  boolean
  emailSessionReminder: boolean
  emailSessionSummary:  boolean
  emailNewBooking:      boolean
  emailPayoutReleased:  boolean
  emailRecordingReady:  boolean
  emailRecordingExpiry: boolean
  emailMarketing:       boolean
  pushSessionAlert:     boolean
  pushNewBooking:       boolean
  pushEmergencyRequest: boolean
  pushPayoutReleased:   boolean
  adminOverrideEmail:   boolean | null
  adminOverridePush:    boolean | null
}

const EMAIL_SETTINGS = [
  { key: 'emailSessionConfirm',  label: 'Session confirmation',     desc: 'When a session is booked' },
  { key: 'emailSessionReminder', label: 'Session reminders',        desc: '1 hour before your session' },
  { key: 'emailSessionSummary',  label: 'Session summary',          desc: 'Notes, parts, and receipt after each session' },
  { key: 'emailNewBooking',      label: 'New booking (experts)',     desc: 'When a customer books you' },
  { key: 'emailPayoutReleased',  label: 'Payout released',          desc: 'When earnings are sent to your account' },
  { key: 'emailRecordingReady',  label: 'Recording ready',          desc: 'When your session recording is available' },
  { key: 'emailRecordingExpiry', label: 'Recording expiry warning', desc: '5 days before a recording expires' },
  { key: 'emailMarketing',       label: 'Tips & updates',           desc: 'Product news, tips, and promotions' },
] as const

const PUSH_SETTINGS = [
  { key: 'pushSessionAlert',     label: 'Session alerts',     desc: 'Reminders and status changes' },
  { key: 'pushNewBooking',       label: 'New bookings',       desc: 'Customer booked a session with you' },
  { key: 'pushEmergencyRequest', label: 'Emergency requests', desc: 'Urgent after-hours booking requests' },
  { key: 'pushPayoutReleased',   label: 'Payout released',    desc: 'Earnings sent to your account' },
] as const

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button onClick={onChange} disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0
        ${on ? 'bg-brand-500' : 'bg-ink-700'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform
        ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

export default function NotificationsPage() {
  const [prefs, setPrefs]   = useState<Prefs | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/notifications/preferences')
      .then(r => r.json())
      .then(d => { setPrefs(d); setLoading(false) })
  }, [])

  const toggle = (key: keyof Prefs) => {
    setPrefs(p => p ? { ...p, [key]: !p[key as keyof Prefs] } : p)
  }

  const save = async () => {
    if (!prefs) return
    setSaving(true)
    await fetch('/api/notifications/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return (
    <div className="p-6 space-y-3">
      {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-ink-800 rounded-xl animate-pulse" />)}
    </div>
  )

  if (!prefs) return null

  const emailLocked = prefs.adminOverrideEmail !== null && prefs.adminOverrideEmail !== undefined
  const pushLocked  = prefs.adminOverridePush  !== null && prefs.adminOverridePush  !== undefined

  return (
    <div className="p-4 sm:p-8 max-w-xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-white">Notifications</h1>
        <button onClick={save} disabled={saving}
          className={`btn-primary text-sm ${saved ? 'bg-green-600' : ''}`}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      {/* Admin override banners */}
      {emailLocked && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-4 text-xs text-yellow-400">
          ⚠️ Email notifications have been {prefs.adminOverrideEmail ? 'enabled' : 'disabled'} by an administrator.
        </div>
      )}
      {pushLocked && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-4 text-xs text-yellow-400">
          ⚠️ Push notifications have been {prefs.adminOverridePush ? 'enabled' : 'disabled'} by an administrator.
        </div>
      )}

      {/* Email */}
      <div className="card overflow-hidden mb-5">
        <div className="px-5 py-4 border-b border-ink-800 flex items-center gap-3">
          <span className="text-base">📧</span>
          <div>
            <h2 className="text-sm font-bold text-white">Email notifications</h2>
            {emailLocked && <p className="text-[10px] text-ink-500">Managed by admin</p>}
          </div>
        </div>
        <div className="divide-y divide-ink-800/60">
          {EMAIL_SETTINGS.map(s => (
            <div key={s.key} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">{s.label}</p>
                <p className="text-xs text-ink-500">{s.desc}</p>
              </div>
              <Toggle
                on={emailLocked ? !!prefs.adminOverrideEmail : !!prefs[s.key as keyof Prefs]}
                onChange={() => !emailLocked && toggle(s.key as keyof Prefs)}
                disabled={emailLocked}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Push */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-ink-800 flex items-center gap-3">
          <span className="text-base">🔔</span>
          <div>
            <h2 className="text-sm font-bold text-white">Push &amp; in-app notifications</h2>
            {pushLocked && <p className="text-[10px] text-ink-500">Managed by admin</p>}
          </div>
        </div>
        <div className="divide-y divide-ink-800/60">
          {PUSH_SETTINGS.map(s => (
            <div key={s.key} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">{s.label}</p>
                <p className="text-xs text-ink-500">{s.desc}</p>
              </div>
              <Toggle
                on={pushLocked ? !!prefs.adminOverridePush : !!prefs[s.key as keyof Prefs]}
                onChange={() => !pushLocked && toggle(s.key as keyof Prefs)}
                disabled={pushLocked}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
TSH_EOF_MARKER

echo '→ writing components/admin/AdminNotificationControls.tsx'
cat > 'components/admin/AdminNotificationControls.tsx' << 'TSH_EOF_MARKER'
'use client'

import { useState } from 'react'

interface Props { userId: string; userName: string }

export function AdminNotificationControls({ userId, userName }: Props) {
  const [overrideEmail, setOverrideEmail] = useState<boolean | null>(null)
  const [overridePush,  setOverridePush]  = useState<boolean | null>(null)
  const [note, setNote]   = useState('')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = async () => {
    const res  = await fetch(`/api/admin/notifications?userId=${userId}`)
    const data = await res.json()
    if (data.prefs) {
      setOverrideEmail(data.prefs.adminOverrideEmail ?? null)
      setOverridePush(data.prefs.adminOverridePush ?? null)
      setNote(data.prefs.adminNote ?? '')
    }
    setLoaded(true)
  }

  const save = async () => {
    setSaving(true)
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, adminOverrideEmail: overrideEmail, adminOverridePush: overridePush, adminNote: note }),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (!loaded) return (
    <button onClick={load} className="btn-ghost text-xs">
      View notification settings
    </button>
  )

  const OverrideSelect = ({ value, onChange }: { value: boolean | null; onChange: (v: boolean | null) => void }) => (
    <select value={value === null ? 'user' : value ? 'force_on' : 'force_off'}
      onChange={e => onChange(e.target.value === 'user' ? null : e.target.value === 'force_on')}
      className="input py-1.5 text-xs w-40">
      <option value="user">User controls</option>
      <option value="force_on">Force ON</option>
      <option value="force_off">Force OFF</option>
    </select>
  )

  return (
    <div className="mt-4 pt-4 border-t border-ink-800 space-y-3">
      <h3 className="text-xs font-bold text-white uppercase tracking-wide">
        Notification overrides for {userName}
      </h3>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label text-[10px]">Email notifications</label>
          <OverrideSelect value={overrideEmail} onChange={setOverrideEmail} />
        </div>
        <div>
          <label className="label text-[10px]">Push notifications</label>
          <OverrideSelect value={overridePush} onChange={setOverridePush} />
        </div>
      </div>

      <div>
        <label className="label text-[10px]">Admin note (internal only)</label>
        <input value={note} onChange={e => setNote(e.target.value)}
          className="input text-xs" placeholder="Reason for override…" />
      </div>

      <button onClick={save} disabled={saving}
        className={`btn-primary text-xs ${saved ? 'bg-green-600' : ''}`}>
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save overrides'}
      </button>
    </div>
  )
}
TSH_EOF_MARKER


# Patch Prisma schema — add NotificationPreferences model
echo "→ patching prisma/schema.prisma"
if ! grep -q "NotificationPreferences" prisma/schema.prisma; then
cat >> prisma/schema.prisma << 'PRISMA_EOF'

model NotificationPreferences {
  id                   String   @id @default(uuid())
  userId               String   @unique
  user                 AuthUser @relation(fields: [userId], references: [id], onDelete: Cascade)
  emailSessionConfirm  Boolean  @default(true)
  emailSessionReminder Boolean  @default(true)
  emailSessionSummary  Boolean  @default(true)
  emailNewBooking      Boolean  @default(true)
  emailPayoutReleased  Boolean  @default(true)
  emailRecordingReady  Boolean  @default(true)
  emailRecordingExpiry Boolean  @default(true)
  emailMarketing       Boolean  @default(false)
  pushSessionAlert     Boolean  @default(true)
  pushNewBooking       Boolean  @default(true)
  pushEmergencyRequest Boolean  @default(true)
  pushPayoutReleased   Boolean  @default(true)
  adminOverrideEmail   Boolean?
  adminOverridePush    Boolean?
  adminNote            String?
  updatedAt            DateTime @default(now())

  @@map("notification_preferences")
}
PRISMA_EOF
echo "  NotificationPreferences model added"
fi

# Add relation to AuthUser model
if ! grep -q "notificationPreferences" prisma/schema.prisma; then
python3 - << 'PYEOF'
schema = open('prisma/schema.prisma').read()
# Add relation after stripeCustomerId field in AuthUser
schema = schema.replace(
  "  stripeCustomerId String?",
  "  stripeCustomerId          String?\n  notificationPreferences   NotificationPreferences?"
)
open('prisma/schema.prisma', 'w').write(schema)
print("  AuthUser relation added")
PYEOF
fi

# Add Notifications link to nav in Shell.tsx
echo "→ adding Notifications to nav"
if ! grep -q "notifications" components/shell/Shell.tsx; then
  sed -i '' "s|{ href: '/customer/profile',         label: 'Profile',  icon: '◉' },|{ href: '/customer/profile',         label: 'Profile',  icon: '◉' },\n    { href: '/customer/notifications',   label: 'Alerts',   icon: '◎' },|" components/shell/Shell.tsx 2>/dev/null || true
  sed -i '' "s|{ href: '/expert/profile',     label: 'Profile',     icon: '◉' },|{ href: '/expert/profile',     label: 'Profile',     icon: '◉' },\n    { href: '/expert/notifications',   label: 'Alerts',   icon: '◎' },|" components/shell/Shell.tsx 2>/dev/null || true
fi

echo ""
echo "✓ Applied. Changes:"
echo "  • lib/auth.ts — email verification now ON (sendOnSignUp: true, requireEmailVerification: true)"
echo "  • Branded HTML verification email template"
echo "  • notification_preferences table with per-user settings"
echo "  • /customer/notifications and /expert/notifications pages"
echo "  • /api/notifications/preferences — user PATCH/GET"
echo "  • /api/admin/notifications — admin override PATCH/GET"
echo "  • AdminNotificationControls component for customer detail pages"
echo ""
echo "IMPORTANT — check Railway env vars:"
echo "  RESEND_API_KEY       — must be set"
echo "  RESEND_FROM_EMAIL    — must be a verified Resend sender domain"
echo "                         e.g. noreply@tightspothelper.com"
echo ""
echo "Now run:"
echo "  git add -A && git commit -m 'Fix email verification + notification preferences' && git push"
