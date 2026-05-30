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
