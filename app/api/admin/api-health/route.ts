import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-helpers'
import { stripe } from '@/lib/stripe'
import { Resend } from 'resend'
import { prisma } from '@/lib/db'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(_req: NextRequest) {
  const { error } = await requireRole('admin')
  if (error) return error

  const results: Record<string, any> = {}

  // ── Stripe ────────────────────────────────────────────────
  try {
    const account = await stripe.accounts.retrieve()
    results.stripe = {
      ok:          true,
      mode:        process.env.STRIPE_SECRET_KEY?.startsWith('sk_live') ? 'live' : 'test',
      accountId:   account.id,
      chargesEnabled: (account as any).charges_enabled ?? true,
      keySet:      !!process.env.STRIPE_SECRET_KEY,
      webhookSet:  !!process.env.STRIPE_WEBHOOK_SECRET,
      pubKeySet:   !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    }
  } catch (err: any) {
    results.stripe = { ok: false, error: err.message, keySet: !!process.env.STRIPE_SECRET_KEY }
  }

  // ── Resend ────────────────────────────────────────────────
  try {
    const domains = await resend.domains.list()
    results.resend = {
      ok:         true,
      keySet:     !!process.env.RESEND_API_KEY,
      fromEmail:  process.env.RESEND_FROM_EMAIL ?? 'NOT SET',
      adminEmail: process.env.ADMIN_EMAIL ?? 'NOT SET',
      domains:    (domains.data as any)?.data?.map((d: any) => ({
        name:   d.name,
        status: d.status,
      })) ?? [],
    }
  } catch (err: any) {
    results.resend = {
      ok:        false,
      error:     err.message,
      keySet:    !!process.env.RESEND_API_KEY,
      fromEmail: process.env.RESEND_FROM_EMAIL ?? 'NOT SET',
    }
  }

  // ── Database ──────────────────────────────────────────────
  try {
    const [users, sessions, experts] = await Promise.all([
      prisma.authUser.count(),
      prisma.session.count(),
      prisma.expertProfile.count({ where: { status: 'approved' } }),
    ])
    results.database = { ok: true, users, sessions, approvedExperts: experts }
  } catch (err: any) {
    results.database = { ok: false, error: err.message }
  }

  // ── Daily.co ──────────────────────────────────────────────
  try {
    const res = await fetch('https://api.daily.co/v1/', {
      headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}` },
    })
    const data = await res.json()
    results.daily = {
      ok:     res.ok,
      keySet: !!process.env.DAILY_API_KEY,
      domain: data.domain_name ?? null,
      error:  res.ok ? null : data.error,
    }
  } catch (err: any) {
    results.daily = { ok: false, error: err.message, keySet: !!process.env.DAILY_API_KEY }
  }

  // ── Env vars summary ──────────────────────────────────────
  results.env = {
    betterAuthSecret:   !!process.env.BETTER_AUTH_SECRET,
    betterAuthUrl:      process.env.BETTER_AUTH_URL ?? 'NOT SET',
    nextPublicAppUrl:   process.env.NEXT_PUBLIC_APP_URL ?? 'NOT SET',
    checkrApiKey:       !!process.env.CHECKR_API_KEY,
    r2AccessKey:        !!process.env.R2_ACCESS_KEY_ID,
    r2SecretKey:        !!process.env.R2_SECRET_ACCESS_KEY,
    supabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    cronSecret:         !!process.env.CRON_SECRET,
    adminEmail:         process.env.ADMIN_EMAIL ?? 'NOT SET',
  }

  const allOk = Object.values(results).every((r: any) => r.ok !== false)
  return NextResponse.json({ ok: allOk, results }, { status: allOk ? 200 : 207 })
}
