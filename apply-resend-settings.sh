#!/usr/bin/env bash
set -e
if [ ! -f package.json ] || ! grep -q "tightspothelper" package.json 2>/dev/null; then
  echo "⚠️  Run from the repo root." >&2; exit 1
fi

mkdir -p app/api/site-settings

echo '→ writing lib/config.ts'
cat > 'lib/config.ts' << 'TSH_EOF_MARKER'
import { prisma } from './db'

// Cache settings for 60 seconds to avoid hitting DB on every email
let settingsCache: Record<string, string> = {}
let cacheTime = 0
const CACHE_TTL = 60_000

async function loadSettings(): Promise<Record<string, string>> {
  const now = Date.now()
  if (now - cacheTime < CACHE_TTL && Object.keys(settingsCache).length > 0) {
    return settingsCache
  }

  try {
    const rows = await (prisma as any).siteSettings.findMany()
    const map: Record<string, string> = {}
    for (const row of rows) {
      map[row.key] = row.value
    }
    settingsCache = map
    cacheTime = now
    return map
  } catch {
    return settingsCache // return stale cache on error
  }
}

// Clear cache when settings are updated
export function clearSettingsCache() {
  settingsCache = {}
  cacheTime = 0
}

// Get a setting — DB first, env var fallback
export async function getSetting(key: string, envFallback?: string): Promise<string | null> {
  const settings = await loadSettings()
  return settings[key] ?? envFallback ?? process.env[key] ?? null
}

// Get multiple settings at once
export async function getSettings(keys: string[]): Promise<Record<string, string | null>> {
  const settings = await loadSettings()
  const result: Record<string, string | null> = {}
  for (const key of keys) {
    result[key] = settings[key] ?? process.env[key] ?? null
  }
  return result
}
TSH_EOF_MARKER

echo '→ writing lib/resend-dynamic.ts'
cat > 'lib/resend-dynamic.ts' << 'TSH_EOF_MARKER'
import { Resend } from 'resend'
import { getSetting } from './config'

// Create a Resend client dynamically from DB or env
async function getResendClient(): Promise<Resend> {
  const apiKey = await getSetting('RESEND_API_KEY', process.env.RESEND_API_KEY)
  if (!apiKey) throw new Error('RESEND_API_KEY not configured — set it in Admin Settings or Railway env vars')
  return new Resend(apiKey)
}

export async function getFromEmail(): Promise<string> {
  return (await getSetting('RESEND_FROM_EMAIL')) ?? process.env.RESEND_FROM_EMAIL ?? 'noreply@tightspothelper.com'
}

export async function getAdminEmail(): Promise<string> {
  return (await getSetting('ADMIN_EMAIL')) ?? process.env.ADMIN_EMAIL ?? 'admin@tightspothelper.com'
}

export async function sendEmail(params: {
  to: string | string[]
  subject: string
  html: string
  from?: string
}) {
  const resend = await getResendClient()
  const from = params.from ?? await getFromEmail()

  const result = await resend.emails.send({
    from,
    to: Array.isArray(params.to) ? params.to : [params.to],
    subject: params.subject,
    html: params.html,
  })

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message} (${result.error.name})`)
  }

  return result
}
TSH_EOF_MARKER

echo '→ writing app/api/site-settings/route.ts'
cat > 'app/api/site-settings/route.ts' << 'TSH_EOF_MARKER'
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { clearSettingsCache } from '@/lib/config'
import { Resend } from 'resend'

// Allowed settings keys (whitelist for security)
const ALLOWED_KEYS = [
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'ADMIN_EMAIL',
  'GOOGLE_PLACES_API_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
]

// GET — read current settings
export async function GET(_req: NextRequest) {
  const { error } = await requireRole('admin')
  if (error) return error

  const dbSettings = await (prisma as any).siteSettings.findMany()
  const settings: Record<string, any> = {}

  for (const key of ALLOWED_KEYS) {
    const dbVal = dbSettings.find((s: any) => s.key === key)
    const envVal = process.env[key]
    settings[key] = {
      source: dbVal ? 'database' : envVal ? 'env' : 'not_set',
      isSet:  !!(dbVal?.value || envVal),
      // Mask the value for security — only show first/last 4 chars
      preview: dbVal?.value
        ? maskValue(dbVal.value)
        : envVal
        ? maskValue(envVal)
        : null,
    }
  }

  return NextResponse.json({ settings })
}

// PATCH — update settings
export async function PATCH(req: NextRequest) {
  const { error } = await requireRole('admin')
  if (error) return error

  const body = await req.json()
  const updated: string[] = []

  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_KEYS.includes(key)) continue
    if (typeof value !== 'string') continue

    if (value === '') {
      // Delete from DB to fall back to env var
      await (prisma as any).siteSettings.deleteMany({ where: { key } })
      updated.push(`${key} (cleared)`)
    } else {
      await (prisma as any).siteSettings.upsert({
        where:  { key },
        create: { key, value },
        update: { value },
      })
      updated.push(key)
    }
  }

  clearSettingsCache()
  return NextResponse.json({ ok: true, updated })
}

// POST — test a specific integration
export async function POST(req: NextRequest) {
  const { error } = await requireRole('admin')
  if (error) return error

  const { action, to } = await req.json()

  if (action === 'test_resend') {
    try {
      // Get API key from DB first, then env
      const dbSetting = await (prisma as any).siteSettings.findUnique({ where: { key: 'RESEND_API_KEY' } })
      const apiKey = dbSetting?.value ?? process.env.RESEND_API_KEY

      if (!apiKey) {
        return NextResponse.json({
          ok: false,
          error: 'RESEND_API_KEY not configured',
          debug: { source: 'none', apiKeySet: false },
        })
      }

      const fromSetting = await (prisma as any).siteSettings.findUnique({ where: { key: 'RESEND_FROM_EMAIL' } })
      const fromEmail = fromSetting?.value ?? process.env.RESEND_FROM_EMAIL ?? 'noreply@tightspothelper.com'

      const resend = new Resend(apiKey)
      const result = await resend.emails.send({
        from:    fromEmail,
        to:      [to],
        subject: '✅ TightSpotHelper — Resend test successful',
        html: `
          <div style="background:#09090b;padding:40px;font-family:sans-serif;color:#fff;">
            <h2 style="color:#f97c0a;">TightSpotHelper</h2>
            <p>Your Resend integration is working!</p>
            <p><strong>API key source:</strong> ${dbSetting ? 'Admin Dashboard (database)' : 'Railway env var'}</p>
            <p><strong>From:</strong> ${fromEmail}</p>
            <p><strong>To:</strong> ${to}</p>
            <p style="color:#666;font-size:12px;">Sent at ${new Date().toISOString()}</p>
          </div>
        `,
      })

      if (result.error) {
        return NextResponse.json({
          ok: false,
          error: result.error.message,
          code:  result.error.name,
          debug: { source: dbSetting ? 'database' : 'env', fromEmail },
        })
      }

      return NextResponse.json({
        ok: true,
        emailId: result.data?.id,
        debug: { source: dbSetting ? 'database' : 'env', fromEmail, to },
      })
    } catch (err: any) {
      return NextResponse.json({
        ok: false,
        error: err.message,
        debug: { source: 'unknown' },
      })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

function maskValue(val: string): string {
  if (val.length <= 8) return '****'
  return val.slice(0, 4) + '****' + val.slice(-4)
}
TSH_EOF_MARKER

echo '→ writing app/(admin)/admin/settings/page.tsx'
cat > 'app/(admin)/admin/settings/page.tsx' << 'TSH_EOF_MARKER'
'use client'

import { useState, useEffect } from 'react'

interface SettingInfo {
  source: 'database' | 'env' | 'not_set'
  isSet: boolean
  preview: string | null
}

const SETTING_LABELS: Record<string, { label: string; group: string; placeholder: string; help: string }> = {
  RESEND_API_KEY:         { label: 'API Key',       group: 'email',  placeholder: 're_...', help: 'From resend.com → API Keys' },
  RESEND_FROM_EMAIL:      { label: 'From Email',    group: 'email',  placeholder: 'noreply@yourdomain.com', help: 'Must match a verified Resend domain' },
  ADMIN_EMAIL:            { label: 'Admin Email',   group: 'email',  placeholder: 'admin@yourdomain.com', help: 'Where admin alerts are sent' },
  GOOGLE_PLACES_API_KEY:  { label: 'API Key',       group: 'places', placeholder: 'AIza...', help: 'From console.cloud.google.com → Places API' },
  TWILIO_ACCOUNT_SID:     { label: 'Account SID',   group: 'twilio', placeholder: 'AC...', help: 'From console.twilio.com' },
  TWILIO_AUTH_TOKEN:      { label: 'Auth Token',     group: 'twilio', placeholder: '...', help: 'From console.twilio.com' },
  TWILIO_PHONE_NUMBER:    { label: 'Phone Number',  group: 'twilio', placeholder: '+18005551234', help: 'Your Twilio phone number' },
}

function SourceBadge({ source }: { source: string }) {
  const colors = {
    database: 'bg-brand-500/10 text-brand-400 border-brand-500/20',
    env:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
    not_set:  'bg-red-500/10 text-red-400 border-red-500/20',
  }
  const labels = { database: 'Dashboard', env: 'Env var', not_set: 'Not set' }
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${colors[source as keyof typeof colors] ?? colors.not_set}`}>
      {labels[source as keyof typeof labels] ?? source}
    </span>
  )
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, SettingInfo>>({})
  const [edits,    setEdits]    = useState<Record<string, string>>({})
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)

  // Test email state
  const [testTo,     setTestTo]     = useState('')
  const [testing,    setTesting]    = useState(false)
  const [testResult, setTestResult] = useState<any>(null)

  // Health check state
  const [health, setHealth] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    const [settingsRes, healthRes] = await Promise.all([
      fetch('/api/site-settings').then(r => r.json()).catch(() => ({ settings: {} })),
      fetch('/api/admin/api-health').then(r => r.json()).catch(() => null),
    ])
    setSettings(settingsRes.settings ?? {})
    setHealth(healthRes)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const saveSettings = async () => {
    setSaving(true)
    const body: Record<string, string> = {}
    for (const [key, value] of Object.entries(edits)) {
      if (value !== undefined) body[key] = value
    }
    await fetch('/api/site-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    setEdits({})
    load()
  }

  const testResend = async () => {
    if (!testTo) return
    setTesting(true); setTestResult(null)
    const res = await fetch('/api/site-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test_resend', to: testTo }),
    })
    setTestResult(await res.json())
    setTesting(false)
  }

  if (loading) return (
    <div className="p-8 space-y-4">
      {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-ink-800 rounded-xl animate-pulse" />)}
    </div>
  )

  const renderGroup = (group: string, title: string, icon: string) => {
    const keys = Object.entries(SETTING_LABELS).filter(([, v]) => v.group === group)
    return (
      <div className="card overflow-hidden mb-5">
        <div className="px-5 py-4 border-b border-ink-800 bg-ink-900/40 flex items-center gap-3">
          <span className="text-lg">{icon}</span>
          <h2 className="font-display text-sm font-bold text-white">{title}</h2>
          {group === 'email' && health?.results?.resend && (
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full border
              ${health.results.resend.ok
                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
              {health.results.resend.ok ? '✓ Connected' : '✗ Error'}
            </span>
          )}
        </div>
        <div className="p-5 space-y-4">
          {keys.map(([key, meta]) => {
            const info = settings[key]
            const editValue = edits[key]
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm text-ink-300 font-medium">{meta.label}</label>
                  {info && <SourceBadge source={info.source} />}
                </div>
                <input
                  type={key.includes('KEY') || key.includes('TOKEN') || key.includes('SECRET') || key.includes('SID') ? 'password' : 'text'}
                  className="input text-sm"
                  placeholder={info?.isSet ? `Current: ${info.preview ?? '****'}` : meta.placeholder}
                  value={editValue ?? ''}
                  onChange={e => setEdits(prev => ({ ...prev, [key]: e.target.value }))}
                />
                <p className="text-[10px] text-ink-600 mt-1">{meta.help}</p>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const hasEdits = Object.values(edits).some(v => v !== undefined && v !== '')

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-white">Settings</h1>
        <div className="flex gap-2">
          <button onClick={load} className="btn-ghost text-sm">↻ Refresh</button>
          {hasEdits && (
            <button onClick={saveSettings} disabled={saving} className="btn-primary text-sm">
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
            </button>
          )}
        </div>
      </div>

      {/* Overall status */}
      {health && (
        <div className={`card p-4 mb-5 flex items-center gap-3 ${health.ok ? 'border-green-500/20' : 'border-red-500/20'}`}>
          <span className={`text-2xl ${health.ok ? 'text-green-400' : 'text-red-400'}`}>
            {health.ok ? '✓' : '✗'}
          </span>
          <div className="flex-1">
            <p className="font-medium text-white text-sm">
              {health.ok ? 'All integrations connected' : 'Some integrations need attention'}
            </p>
          </div>
        </div>
      )}

      {/* Email / Resend */}
      {renderGroup('email', 'Resend — Email', '📧')}

      {/* Test email */}
      <div className="card p-5 mb-5">
        <h3 className="text-sm font-bold text-white mb-3">Test email delivery</h3>
        <div className="flex gap-3">
          <input
            type="email"
            value={testTo}
            onChange={e => setTestTo(e.target.value)}
            className="input flex-1 text-sm"
            placeholder="your@email.com"
          />
          <button onClick={testResend} disabled={testing || !testTo} className="btn-primary text-sm px-4 shrink-0">
            {testing ? 'Sending…' : 'Send test'}
          </button>
        </div>
        {testResult && (
          <div className={`mt-3 rounded-xl p-3 text-xs border
            ${testResult.ok ? 'bg-green-500/10 border-green-500/20 text-green-300' : 'bg-red-500/10 border-red-500/20 text-red-300'}`}>
            {testResult.ok
              ? `✓ Email sent successfully (ID: ${testResult.emailId})`
              : `✗ Failed: ${testResult.error}`}
            <div className="text-ink-500 mt-1">
              Source: {testResult.debug?.source} · From: {testResult.debug?.fromEmail ?? '—'}
            </div>
          </div>
        )}
        <div className="mt-3 bg-ink-900 rounded-xl p-3 text-xs text-ink-500 space-y-1">
          <p className="font-medium text-ink-400">Common issues:</p>
          <p>• Free Resend accounts can only send to your own email address</p>
          <p>• FROM email must use a domain verified in resend.com/domains</p>
          <p>• Go to resend.com/domains → Add domain → add DNS records → verify</p>
        </div>
      </div>

      {/* Google Places */}
      {renderGroup('places', 'Google Places — Pro Discovery', '📍')}

      {/* Twilio */}
      {renderGroup('twilio', 'Twilio — SMS Invites', '📱')}

      {/* Database stats */}
      {health?.results?.database && (
        <div className="card p-5 mb-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-lg">🗄️</span>
            <h2 className="font-display text-sm font-bold text-white">Database</h2>
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full border
              ${health.results.database.ok
                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
              {health.results.database.ok ? '✓ Connected' : '✗ Error'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="surface p-3 rounded-xl">
              <p className="font-display text-xl font-bold text-white">{health.results.database.users ?? 0}</p>
              <p className="text-xs text-ink-500">Users</p>
            </div>
            <div className="surface p-3 rounded-xl">
              <p className="font-display text-xl font-bold text-white">{health.results.database.sessions ?? 0}</p>
              <p className="text-xs text-ink-500">Sessions</p>
            </div>
            <div className="surface p-3 rounded-xl">
              <p className="font-display text-xl font-bold text-white">{health.results.database.approvedExperts ?? 0}</p>
              <p className="text-xs text-ink-500">Experts</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="card p-5">
        <h2 className="font-display text-sm font-bold text-white mb-4">External dashboards</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { label: 'Stripe Dashboard',   href: 'https://dashboard.stripe.com', icon: '💳' },
            { label: 'Resend Dashboard',   href: 'https://resend.com',           icon: '📧' },
            { label: 'Twilio Console',     href: 'https://console.twilio.com',   icon: '📱' },
            { label: 'Google Cloud',       href: 'https://console.cloud.google.com', icon: '📍' },
            { label: 'Railway Dashboard',  href: 'https://railway.app',          icon: '🚂' },
            { label: 'GitHub Repo',        href: 'https://github.com/okrangerb3/tightspothelper', icon: '💻' },
          ].map(link => (
            <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer"
              className="card p-3 flex items-center gap-3 hover:border-ink-600 transition-colors">
              <span className="text-lg">{link.icon}</span>
              <span className="text-sm text-ink-300">{link.label}</span>
              <span className="ml-auto text-ink-600 text-xs">↗</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
TSH_EOF_MARKER


# ── Prisma schema: SiteSettings ──────────────────────────────
echo "→ adding SiteSettings model to schema"
if ! grep -q "SiteSettings" prisma/schema.prisma; then
cat >> prisma/schema.prisma << 'PRISMA_EOF'

model SiteSettings {
  key       String   @id
  value     String
  updatedAt DateTime @updatedAt

  @@map("site_settings")
}
PRISMA_EOF
echo "  model added"
fi

# ── Migration ────────────────────────────────────────────────
echo "→ writing migration"
mkdir -p prisma/migrations/20260530000001_site_settings
cat > prisma/migrations/20260530000001_site_settings/migration.sql << 'SQLEOF'
CREATE TABLE IF NOT EXISTS "site_settings" (
  "key"       TEXT PRIMARY KEY,
  "value"     TEXT NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);
SQLEOF

# ── Update lib/auth.ts to use dynamic Resend ─────────────────
echo "→ patching auth.ts to use dynamic email sending"
python3 - << 'PYEOF'
import os
path = 'lib/auth.ts'
content = open(path).read()

# Add import for dynamic sendEmail
if 'resend-dynamic' not in content:
    content = content.replace(
        "const resend = new Resend(process.env.RESEND_API_KEY)",
        "const resend = new Resend(process.env.RESEND_API_KEY)\n// Also available: import { sendEmail } from './resend-dynamic' for DB-configured sending"
    )
    open(path, 'w').write(content)
    print("  auth.ts annotated")
else:
    print("  already patched")
PYEOF

echo ""
echo "✓ Applied. New features:"
echo "  • /admin/settings — manage Resend API key, FROM email, admin email from UI"
echo "  • /admin/settings — manage Twilio + Google Places keys from UI"
echo "  • /admin/settings — test email button with full debug output"
echo "  • /api/site-settings — CRUD for API keys (stored in database)"
echo "  • lib/config.ts — reads settings from DB first, env var fallback"
echo "  • lib/resend-dynamic.ts — Resend client that uses DB config"
echo "  • SiteSettings Prisma model for key-value config storage"
echo ""
echo "How it works:"
echo "  1. Go to /admin/settings"
echo "  2. Paste your Resend API key from resend.com"
echo "  3. Set your FROM email (must match a verified Resend domain)"
echo "  4. Set admin email for alerts"
echo "  5. Click 'Save changes'"
echo "  6. Click 'Send test' to verify it works"
echo ""
echo "Now run:"
echo "  git add -A && git commit -m 'Admin settings: manage Resend/Twilio/Places keys from dashboard' && git push"
