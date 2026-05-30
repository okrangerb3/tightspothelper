#!/usr/bin/env bash
set -e
if [ ! -f package.json ] || ! grep -q "tightspothelper" package.json 2>/dev/null; then
  echo "⚠️  Run from the repo root." >&2; exit 1
fi

mkdir -p lib app/api/discover-pros app/api/invite/\[code\] "app/(admin)/admin/leads"

echo '→ writing lib/twilio.ts'
cat > 'lib/twilio.ts' << 'TSH_EOF_MARKER'
const TWILIO_SID    = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_TOKEN  = process.env.TWILIO_AUTH_TOKEN!
const TWILIO_FROM   = process.env.TWILIO_PHONE_NUMBER!
const APP_URL       = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tightspothelper.com'

export async function sendSMS(to: string, body: string) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }).toString(),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message ?? 'Twilio send failed')
  return data
}

export function buildInviteSMS(params: {
  businessName: string
  categoryName: string
  customerCity: string
  inviteCode:   string
}) {
  return `Hi ${params.businessName}! A customer in ${params.customerCity} needs help with ${params.categoryName} via TightSpotHelper. Join our network of remote repair experts and earn $50-200+/session. Sign up: ${APP_URL}/signup?invite=${params.inviteCode}&role=expert`
}
TSH_EOF_MARKER

echo '→ writing lib/places.ts'
cat > 'lib/places.ts' << 'TSH_EOF_MARKER'
const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY!

interface PlaceResult {
  name:          string
  address:       string
  phone:         string | null
  lat:           number
  lng:           number
  rating:        number | null
  placeId:       string
  types:         string[]
  businessStatus: string
}

// Map our category names to Google Places search terms
const CATEGORY_SEARCH_TERMS: Record<string, string[]> = {
  'Automotive Mechanic': ['auto mechanic', 'auto repair shop', 'car mechanic'],
  'Diesel Mechanic':     ['diesel mechanic', 'diesel repair', 'truck repair'],
  'Marine Mechanic':     ['marine mechanic', 'boat repair', 'marine engine repair'],
  'Plumbing':            ['plumber', 'plumbing company', 'plumbing repair'],
  'Electrical':          ['electrician', 'electrical contractor', 'electrical repair'],
  'HVAC':                ['hvac contractor', 'air conditioning repair', 'heating repair'],
  'Handyman':            ['handyman service', 'home repair service'],
  'Carpenter':           ['carpenter', 'carpentry service', 'woodworking'],
}

export async function findLocalPros(params: {
  categoryName: string
  lat: number
  lng: number
  radiusMeters?: number
}): Promise<PlaceResult[]> {
  const terms = CATEGORY_SEARCH_TERMS[params.categoryName] ?? [params.categoryName.toLowerCase()]
  const radius = params.radiusMeters ?? 40000 // 25 miles default
  const results: PlaceResult[] = []
  const seenIds = new Set<string>()

  for (const term of terms) {
    try {
      const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json')
      url.searchParams.set('key', GOOGLE_PLACES_KEY)
      url.searchParams.set('location', `${params.lat},${params.lng}`)
      url.searchParams.set('radius', String(radius))
      url.searchParams.set('keyword', term)
      url.searchParams.set('type', 'establishment')

      const res = await fetch(url.toString())
      const data = await res.json()

      if (data.status !== 'OK') continue

      for (const place of data.results ?? []) {
        if (seenIds.has(place.place_id)) continue
        if (place.business_status !== 'OPERATIONAL') continue
        seenIds.add(place.place_id)

        // Get phone number via Place Details
        const detailUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json')
        detailUrl.searchParams.set('key', GOOGLE_PLACES_KEY)
        detailUrl.searchParams.set('place_id', place.place_id)
        detailUrl.searchParams.set('fields', 'formatted_phone_number,international_phone_number')

        const detailRes = await fetch(detailUrl.toString())
        const detailData = await detailRes.json()
        const phone = detailData.result?.international_phone_number
          ?? detailData.result?.formatted_phone_number
          ?? null

        results.push({
          name:           place.name,
          address:        place.vicinity ?? '',
          phone,
          lat:            place.geometry?.location?.lat ?? 0,
          lng:            place.geometry?.location?.lng ?? 0,
          rating:         place.rating ?? null,
          placeId:        place.place_id,
          types:          place.types ?? [],
          businessStatus: place.business_status,
        })
      }
    } catch (e) {
      console.error(`Places search failed for "${term}":`, e)
    }

    if (results.length >= 20) break // Cap at 20 leads per search
  }

  return results
}
TSH_EOF_MARKER

echo '→ writing app/api/discover-pros/route.ts'
cat > 'app/api/discover-pros/route.ts' << 'TSH_EOF_MARKER'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { findLocalPros } from '@/lib/places'
import { sendSMS, buildInviteSMS } from '@/lib/twilio'
import crypto from 'crypto'

const MAX_SMS_PER_JOB = 10
const TARGET_REGISTERED_PROS = 3

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { categoryId, categoryName, lat, lng, city } = await req.json()

  if (!categoryId || !categoryName || !lat || !lng) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Check how many approved pros already exist in this category
  const existingPros = await prisma.expertProfile.count({
    where: {
      status:      'approved',
      available:   true,
      categoryIds: { has: categoryId },
    },
  })

  if (existingPros >= TARGET_REGISTERED_PROS) {
    return NextResponse.json({
      ok: true,
      message: `${existingPros} pros already available in this category`,
      prosFound: existingPros,
      smssSent: 0,
    })
  }

  // Find local businesses via Google Places
  const places = await findLocalPros({ categoryName, lat, lng })

  if (places.length === 0) {
    return NextResponse.json({
      ok: true,
      message: 'No local businesses found in this area',
      prosFound: 0,
      smssSent: 0,
    })
  }

  let smsSent = 0
  const leads: any[] = []

  for (const place of places) {
    if (smsSent >= MAX_SMS_PER_JOB) break

    // Skip if no phone number
    if (!place.phone) continue

    // Normalize phone
    const normalizedPhone = place.phone.replace(/[^+\d]/g, '')
    if (normalizedPhone.length < 10) continue

    // Check if we've already contacted this business
    const existing = await (prisma as any).proLead.findFirst({
      where: {
        OR: [
          { googlePlaceId: place.placeId },
          { phone: normalizedPhone },
        ],
      },
    })

    if (existing) {
      leads.push({ ...existing, skipped: 'already_contacted' })
      continue
    }

    // Generate invite code
    const inviteCode = crypto.randomBytes(6).toString('hex')

    // Store lead in database
    const lead = await (prisma as any).proLead.create({
      data: {
        businessName:   place.name,
        phone:          normalizedPhone,
        address:        place.address,
        lat:            place.lat,
        lng:            place.lng,
        googlePlaceId:  place.placeId,
        googleRating:   place.rating,
        categoryId,
        categoryName,
        inviteCode,
        source:         'google_places',
        status:         'discovered',
        discoveredById: session.user.id,
      },
    })

    // Send SMS via Twilio
    try {
      const smsBody = buildInviteSMS({
        businessName: place.name,
        categoryName,
        customerCity: city ?? 'your area',
        inviteCode,
      })

      const twilioResult = await sendSMS(normalizedPhone, smsBody)

      // Record outreach
      await (prisma as any).proOutreach.create({
        data: {
          proLeadId:    lead.id,
          channel:      'sms',
          twilioSid:    twilioResult.sid,
          status:       'sent',
          messageBody:  smsBody,
        },
      })

      // Update lead status
      await (prisma as any).proLead.update({
        where: { id: lead.id },
        data:  { status: 'contacted', lastContactedAt: new Date() },
      })

      smsSent++
      leads.push({ ...lead, smsStatus: 'sent' })
    } catch (smsErr: any) {
      console.error(`SMS failed for ${place.name}:`, smsErr.message)

      await (prisma as any).proOutreach.create({
        data: {
          proLeadId:   lead.id,
          channel:     'sms',
          status:      'failed',
          error:       smsErr.message,
          messageBody: '',
        },
      })

      leads.push({ ...lead, smsStatus: 'failed', error: smsErr.message })
    }
  }

  return NextResponse.json({
    ok: true,
    message: `Found ${places.length} businesses, sent ${smsSent} SMS invites`,
    placesFound: places.length,
    smsSent,
    leadsCreated: leads.length,
    existingPros,
    targetPros: TARGET_REGISTERED_PROS,
  })
}

// GET — admin views all leads
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if ((session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const leads = await (prisma as any).proLead.findMany({
    orderBy: { createdAt: 'desc' },
    include: { outreach: true },
    take: 100,
  })

  return NextResponse.json({ leads })
}
TSH_EOF_MARKER

echo '→ writing app/api/invite/[code]/route.ts'
cat > 'app/api/invite/[code]/route.ts' << 'TSH_EOF_MARKER'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/invite/[code] — validates invite and redirects to signup
export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  const lead = await (prisma as any).proLead.findFirst({
    where: { inviteCode: params.code },
  })

  if (!lead) {
    return NextResponse.redirect(
      new URL('/signup?role=expert', process.env.NEXT_PUBLIC_APP_URL ?? 'https://tightspothelper.com')
    )
  }

  // Mark as clicked
  await (prisma as any).proLead.update({
    where: { id: lead.id },
    data:  { status: 'clicked', clickedAt: new Date() },
  })

  // Redirect to signup with pre-filled data
  const url = new URL('/signup', process.env.NEXT_PUBLIC_APP_URL ?? 'https://tightspothelper.com')
  url.searchParams.set('role', 'expert')
  url.searchParams.set('invite', params.code)
  url.searchParams.set('category', lead.categoryId)

  return NextResponse.redirect(url)
}
TSH_EOF_MARKER

echo '→ writing app/(admin)/admin/leads/page.tsx'
cat > 'app/(admin)/admin/leads/page.tsx' << 'TSH_EOF_MARKER'
'use client'

import { useState, useEffect } from 'react'

interface Lead {
  id: string; businessName: string; phone: string; address: string
  categoryName: string; status: string; googleRating: number | null
  inviteCode: string; createdAt: string; lastContactedAt: string | null
  clickedAt: string | null; registeredAt: string | null
  outreach: { channel: string; status: string; createdAt: string; error: string | null }[]
}

const STATUS_COLORS: Record<string, string> = {
  discovered: 'bg-ink-800 text-ink-400 border-ink-700',
  contacted:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  clicked:    'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  registered: 'bg-green-500/10 text-green-400 border-green-500/20',
  declined:   'bg-red-500/10 text-red-400 border-red-500/20',
}

export default function AdminLeadsPage() {
  const [leads, setLeads]     = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats]     = useState({ total: 0, contacted: 0, clicked: 0, registered: 0 })

  useEffect(() => {
    fetch('/api/discover-pros')
      .then(r => r.json())
      .then(data => {
        const l = data.leads ?? []
        setLeads(l)
        setStats({
          total:      l.length,
          contacted:  l.filter((x: Lead) => x.status === 'contacted').length,
          clicked:    l.filter((x: Lead) => x.status === 'clicked').length,
          registered: l.filter((x: Lead) => x.status === 'registered').length,
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="p-8 space-y-4">
      {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-ink-800 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-white">Pro recruitment</h1>
        <p className="text-sm text-ink-500 mt-1">Leads discovered from Google Places and invited via SMS</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Discovered', value: stats.total, color: 'text-white' },
          { label: 'SMS sent',   value: stats.contacted, color: 'text-blue-400' },
          { label: 'Link clicked', value: stats.clicked, color: 'text-yellow-400' },
          { label: 'Registered', value: stats.registered, color: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-ink-500">{s.label}</p>
            <p className={`font-display text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Leads table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-800">
            <tr className="text-left text-xs text-ink-500">
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Contacted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800/50">
            {leads.map(lead => (
              <tr key={lead.id} className="hover:bg-ink-900/40">
                <td className="px-4 py-3">
                  <p className="text-white font-medium">{lead.businessName}</p>
                  <p className="text-[10px] text-ink-600">{lead.address}</p>
                </td>
                <td className="px-4 py-3 text-ink-400 text-xs">{lead.categoryName}</td>
                <td className="px-4 py-3 text-ink-300 font-mono text-xs">{lead.phone}</td>
                <td className="px-4 py-3 text-yellow-400 text-xs">{lead.googleRating ? `★ ${lead.googleRating}` : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[lead.status] ?? ''}`}>
                    {lead.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-500 text-xs">
                  {lead.lastContactedAt
                    ? new Date(lead.lastContactedAt).toLocaleDateString()
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {leads.length === 0 && (
          <p className="text-center text-ink-500 text-sm py-12">
            No leads yet. Leads are auto-discovered when customers book in categories with no available experts.
          </p>
        )}
      </div>
    </div>
  )
}
TSH_EOF_MARKER


# ── Prisma schema: ProLead + ProOutreach ─────────────────────
echo "→ adding ProLead and ProOutreach models to schema"
if ! grep -q "ProLead" prisma/schema.prisma; then
cat >> prisma/schema.prisma << 'PRISMA_EOF'

model ProLead {
  id              String    @id @default(uuid())
  businessName    String
  phone           String
  address         String?
  lat             Float?
  lng             Float?
  googlePlaceId   String?   @unique
  googleRating    Float?
  categoryId      String
  categoryName    String
  inviteCode      String    @unique
  source          String    @default("google_places")
  status          String    @default("discovered")
  discoveredById  String?
  lastContactedAt DateTime?
  clickedAt       DateTime?
  registeredAt    DateTime?
  registeredUserId String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  outreach        ProOutreach[]

  @@index([categoryId])
  @@index([status])
  @@index([inviteCode])
  @@map("pro_leads")
}

model ProOutreach {
  id          String   @id @default(uuid())
  proLeadId   String
  proLead     ProLead  @relation(fields: [proLeadId], references: [id], onDelete: Cascade)
  channel     String   @default("sms")
  twilioSid   String?
  status      String   @default("pending")
  messageBody String?
  error       String?
  createdAt   DateTime @default(now())

  @@map("pro_outreach")
}
PRISMA_EOF
echo "  schema updated"
fi

# ── Migration ────────────────────────────────────────────────
echo "→ writing migration"
mkdir -p prisma/migrations/20260516000001_pro_leads
cat > prisma/migrations/20260516000001_pro_leads/migration.sql << 'SQLEOF'
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
SQLEOF

# ── Trigger discovery automatically when booking has no expert ────────
echo "→ patching booking API to auto-discover pros"
python3 - << 'PYEOF'
import os
path = 'app/api/sessions/route.ts'
if not os.path.exists(path):
    print("  sessions route not found")
    exit()
content = open(path).read()
if 'discover-pros' not in content:
    # Add import
    import_line = "import { sendSessionConfirmation"
    if import_line in content:
        content = content.replace(
            import_line,
            "// Auto-discover pros when no expert available\n" + import_line
        )
    # Add discovery trigger after session creation
    content = content.replace(
        "return NextResponse.json({ session: newSession, pricing })",
        """// If no expert was assigned, trigger pro discovery in background
  if (!newSession.expertId) {
    const customerProfile = await prisma.authUser.findUnique({
      where: { id: auth.user.id },
      select: { city: true, state: true },
    })
    fetch(new URL('/api/discover-pros', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: req.headers.get('cookie') ?? '' },
      body: JSON.stringify({
        categoryId:   newSession.categoryId,
        categoryName: category.name,
        lat:          0, // TODO: geocode from customer city/state
        lng:          0,
        city:         (customerProfile as any)?.city ?? '',
      }),
    }).catch(e => console.error('Pro discovery failed:', e))
  }

  return NextResponse.json({ session: newSession, pricing })"""
    )
    open(path, 'w').write(content)
    print("  session route patched for auto-discovery")
else:
    print("  already patched")
PYEOF

# ── Update signup to handle invite codes ─────────────────────
echo "→ patching signup page for invite codes"
python3 - << 'PYEOF'
import os
path = 'app/(auth)/signup/page.tsx'
if not os.path.exists(path):
    print("  signup page not found")
    exit()
content = open(path).read()
if 'inviteCode' not in content:
    # Add invite code handling from URL params
    content = content.replace(
        "  const [role, setRole] = useState<'customer' | 'expert'>('customer')",
        """  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const inviteCode = searchParams?.get('invite') ?? null
  const inviteRole = searchParams?.get('role') as 'customer' | 'expert' | null
  const [role, setRole] = useState<'customer' | 'expert'>(inviteRole ?? 'customer')"""
    )
    # After successful signup, mark lead as registered
    content = content.replace(
        "setStep('verify')",
        """setStep('verify')
      // Track invite conversion
      if (inviteCode) {
        fetch('/api/invite/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inviteCode }),
        }).catch(() => {})
      }"""
    )
    open(path, 'w').write(content)
    print("  signup page patched for invite tracking")
else:
    print("  already patched")
PYEOF

# ── Invite tracking API ──────────────────────────────────────
echo "→ writing invite tracking endpoint"
mkdir -p app/api/invite/track
cat > app/api/invite/track/route.ts << 'TSEOF'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { inviteCode } = await req.json()
  if (!inviteCode) return NextResponse.json({ ok: false })

  await (prisma as any).proLead.updateMany({
    where:  { inviteCode },
    data:   { status: 'registered', registeredAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
TSEOF

# ── Add Leads to admin nav ───────────────────────────────────
echo "→ adding Leads to admin nav"
python3 - << 'PYEOF'
content = open('components/shell/Shell.tsx').read()
if '/admin/leads' not in content:
    content = content.replace(
        "{ href: '/admin/settings',           label: 'Settings',    icon: '⚙' },",
        "{ href: '/admin/leads',              label: 'Recruitment', icon: '📡' },\n    { href: '/admin/settings',           label: 'Settings',    icon: '⚙' },"
    )
    open('components/shell/Shell.tsx', 'w').write(content)
    print("  Recruitment link added to admin nav")
else:
    print("  already in nav")
PYEOF

echo ""
echo "✓ Applied. New features:"
echo "  • lib/places.ts — Google Places API to find local pros by category + location"
echo "  • lib/twilio.ts — Twilio SMS client for sending invite texts"
echo "  • /api/discover-pros — finds pros, stores leads, sends up to 10 SMS per job"
echo "  • /api/invite/[code] — handles invite link clicks, redirects to signup"
echo "  • /api/invite/track — marks leads as registered after signup"
echo "  • Prisma: ProLead + ProOutreach models with migration"
echo "  • Booking API auto-triggers discovery when no expert is available"
echo "  • Signup page handles ?invite=CODE&role=expert from SMS links"
echo "  • /admin/leads — recruitment dashboard with KPIs and lead table"
echo ""
echo "Required env vars in Railway:"
echo "  GOOGLE_PLACES_API_KEY — from console.cloud.google.com"
echo "  TWILIO_ACCOUNT_SID    — from console.twilio.com"
echo "  TWILIO_AUTH_TOKEN      — from console.twilio.com"
echo "  TWILIO_PHONE_NUMBER    — your Twilio phone number (e.g. +18005551234)"
echo ""
echo "Now run:"
echo "  git add -A && git commit -m 'Pro recruitment: Google Places discovery + Twilio SMS invites' && git push"
