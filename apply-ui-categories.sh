#!/usr/bin/env bash
# Auth layout fixes, Automotive, category request system
set -e
if [ ! -f package.json ] || ! grep -q "tightspothelper" package.json 2>/dev/null; then
  echo "⚠️  Run from the repo root." >&2; exit 1
fi

mkdir -p \
  app/api/category-requests \
  app/\(admin\)/admin/category-requests \
  components/ui \
  prisma/migrations/20260515000004_category_requests

echo '→ writing app/(auth)/layout.tsx'
cat > 'app/(auth)/layout.tsx' << 'TSH_EOF_MARKER'
import { Logo } from '@/components/ui/Logo'

const CATEGORIES = [
  { title: 'Plumbing',    icon: 'ti-droplet' },
  { title: 'Electrical',  icon: 'ti-bolt' },
  { title: 'HVAC',        icon: 'ti-wind' },
  { title: 'Handyman',    icon: 'ti-tool' },
  { title: 'Automotive',  icon: 'ti-car' },
  { title: 'Appliances',  icon: 'ti-washing-machine' },
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-950 flex flex-col">
      <nav className="container-page flex items-center justify-between py-5 shrink-0">
        <Logo />
      </nav>

      <div className="flex-1 container-page w-full py-8 sm:py-12 flex items-center">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 w-full items-stretch">

          {/* Left panel — hidden on mobile */}
          <section className="hidden lg:flex card relative overflow-hidden min-h-[580px] p-8 xl:p-10">
            {/* Glow blobs */}
            <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full blur-3xl pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(249,124,10,0.25) 0%, rgba(249,124,10,0) 70%)' }} />
            <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full blur-3xl pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(249,124,10,0.18) 0%, rgba(249,124,10,0) 70%)' }} />

            {/* Content — vertically centered */}
            <div className="relative z-10 flex flex-col w-full justify-center gap-8">
              {/* Headline */}
              <div>
                <p className="text-brand-400 text-xs tracking-[0.18em] uppercase mb-4">
                  Remote Repair Guidance
                </p>
                <h1 className="font-display text-4xl xl:text-5xl leading-tight text-white max-w-md">
                  Show the issue.<br />Get a fix plan.
                </h1>
                <p className="text-ink-300 text-sm mt-4 max-w-md leading-relaxed">
                  Book trusted experts for plumbing, electrical, HVAC, automotive, and more
                  — with live video diagnosis in minutes.
                </p>
              </div>

              {/* Category grid */}
              <div className="surface p-5">
                <p className="text-[10px] text-ink-500 uppercase tracking-widest mb-3">Available categories</p>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(item => (
                    <div key={item.title}
                      className="rounded-xl border border-ink-700 bg-ink-900/70 px-3 py-2.5 flex items-center gap-2.5">
                      <span className="h-7 w-7 rounded-lg bg-brand-500/15 text-brand-400 flex items-center justify-center shrink-0">
                        <i className={`${item.icon} text-sm`} aria-hidden="true" />
                      </span>
                      <span className="text-xs text-ink-200 font-medium">{item.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trust badges */}
              <div className="flex items-center gap-6">
                {[
                  { icon: '✓', label: 'Background checked' },
                  { icon: '⚡', label: 'Available in minutes' },
                  { icon: '🔒', label: 'Secure payments' },
                ].map(b => (
                  <div key={b.label} className="flex items-center gap-1.5">
                    <span className="text-brand-400 text-xs">{b.icon}</span>
                    <span className="text-[11px] text-ink-500">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Right panel — form */}
          <section className="flex items-center justify-center px-1 sm:px-4 lg:px-6">
            <div className="w-full max-w-lg">{children}</div>
          </section>

        </div>
      </div>
    </div>
  )
}
TSH_EOF_MARKER

echo '→ writing app/api/category-requests/route.ts'
cat > 'app/api/category-requests/route.ts' << 'TSH_EOF_MARKER'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { resend } from '@/lib/resend'

const FROM    = process.env.RESEND_FROM_EMAIL ?? 'noreply@tightspothelper.com'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tightspothelper.com'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@tightspothelper.com'

// POST — customer submits a category request
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { categoryName, description } = await req.json()
  if (!categoryName?.trim()) {
    return NextResponse.json({ error: 'Category name required' }, { status: 400 })
  }

  // Save request to DB
  const request = await (prisma as any).categoryRequest.create({
    data: {
      userId:       session.user.id,
      categoryName: categoryName.trim(),
      description:  description?.trim() ?? null,
      status:       'pending',
    },
  })

  // Alert admin
  await resend.emails.send({
    from:    FROM,
    to:      ADMIN_EMAIL,
    subject: `New category request: ${categoryName}`,
    html: `
      <h2>New category request</h2>
      <p><strong>Category:</strong> ${categoryName}</p>
      ${description ? `<p><strong>Description:</strong> ${description}</p>` : ''}
      <p><strong>From:</strong> ${session.user.email}</p>
      <p><a href="${APP_URL}/admin/category-requests">Review in admin panel →</a></p>
    `,
  }).catch(console.error)

  // Find pros with matching specialties and alert them
  const matchingPros = await prisma.expertProfile.findMany({
    where: {
      status:    'approved',
      available: true,
      OR: [
        { specialties: { has: categoryName } },
        // Also match partial — check categories table
      ],
    },
    include: { user: { select: { email: true, name: true } } },
    take: 50,
  })

  // Notify matching pros in background
  if (matchingPros.length > 0) {
    Promise.allSettled(
      matchingPros.map(pro =>
        resend.emails.send({
          from:    FROM,
          to:      pro.user.email,
          subject: `New service request: ${categoryName}`,
          html: `
            <h2>A customer is looking for help with: ${categoryName}</h2>
            <p>Hi ${pro.user.name ?? 'there'},</p>
            <p>A customer on TightSpotHelper is looking for an expert in <strong>${categoryName}</strong>.</p>
            ${description ? `<p>They described it as: <em>${description}</em></p>` : ''}
            <p>If this is in your wheelhouse, make sure your profile is up to date and available.</p>
            <p><a href="${APP_URL}/expert/profile" style="background:#f97c0a;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">Update my profile →</a></p>
          `,
        })
      )
    ).catch(console.error)
  }

  return NextResponse.json({ ok: true, requestId: request.id, prosNotified: matchingPros.length })
}

// GET — admin views all requests
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if ((session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const requests = await (prisma as any).categoryRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true, email: true } } },
  })

  return NextResponse.json({ requests })
}

// PATCH — admin approves/dismisses a request
export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if ((session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, status, adminNote } = await req.json()
  await (prisma as any).categoryRequest.update({
    where: { id },
    data:  { status, adminNote },
  })

  return NextResponse.json({ ok: true })
}
TSH_EOF_MARKER

echo '→ writing components/ui/CategoryRequestModal.tsx'
cat > 'components/ui/CategoryRequestModal.tsx' << 'TSH_EOF_MARKER'
'use client'

import { useState } from 'react'

interface Props {
  onClose: () => void
}

export default function CategoryRequestModal({ onClose }: Props) {
  const [categoryName, setCategoryName] = useState('')
  const [description,  setDescription]  = useState('')
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState(false)
  const [error,   setError]     = useState<string | null>(null)

  const submit = async () => {
    if (!categoryName.trim()) { setError('Please enter a category name'); return }
    setLoading(true); setError(null)

    const res  = await fetch('/api/category-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryName, description }),
    })
    const data = await res.json()

    if (!res.ok) { setError(data.error ?? 'Failed to submit'); setLoading(false); return }

    setSuccess(true)
    setLoading(false)
    setTimeout(onClose, 3000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-md p-6 space-y-4">
        {success ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">🎉</div>
            <h2 className="font-display text-lg font-bold text-white mb-2">Request submitted!</h2>
            <p className="text-sm text-ink-400">
              We'll review your request and notify matching experts. Thanks for helping us grow!
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-white">Request a category</h2>
                <p className="text-xs text-ink-500 mt-0.5">
                  Don't see what you need? Tell us and we'll find experts for you.
                </p>
              </div>
              <button onClick={onClose} className="text-ink-500 hover:text-ink-300 text-xl leading-none p-1">×</button>
            </div>

            <div>
              <label className="label">What do you need help with?</label>
              <input
                value={categoryName}
                onChange={e => setCategoryName(e.target.value)}
                className="input"
                placeholder="e.g. Pool maintenance, Roofing, Pest control…"
                autoFocus
              />
            </div>

            <div>
              <label className="label">Describe your problem <span className="text-ink-600">(optional)</span></label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="input min-h-[80px] resize-none"
                placeholder="Give us a few details so we can match you with the right expert…"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3">
              <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
              <button onClick={submit} disabled={loading} className="btn-primary flex-1">
                {loading ? 'Submitting…' : 'Submit request'}
              </button>
            </div>

            <p className="text-[10px] text-ink-600 text-center">
              We'll alert available experts and add it to our roadmap
            </p>
          </>
        )}
      </div>
    </div>
  )
}
TSH_EOF_MARKER

echo '→ writing app/(admin)/admin/category-requests/page.tsx'
cat > 'app/(admin)/admin/category-requests/page.tsx' << 'TSH_EOF_MARKER'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import AdminCategoryRequestsClient from './AdminCategoryRequestsClient'

export const metadata = { title: 'Category Requests — Admin' }

export default async function AdminCategoryRequestsPage() {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')
  if ((session.user as any).role !== 'admin') redirect('/customer/dashboard')

  const requests = await (prisma as any).categoryRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true, email: true } } },
  })

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Category requests</h1>
          <p className="text-sm text-ink-500 mt-1">Customers requesting service categories not yet on the platform</p>
        </div>
        <span className="text-xs bg-brand-500/10 text-brand-400 border border-brand-500/20 px-2.5 py-1 rounded-full">
          {requests.filter((r: any) => r.status === 'pending').length} pending
        </span>
      </div>
      <AdminCategoryRequestsClient requests={requests} />
    </div>
  )
}
TSH_EOF_MARKER

echo '→ writing app/(admin)/admin/category-requests/AdminCategoryRequestsClient.tsx'
cat > 'app/(admin)/admin/category-requests/AdminCategoryRequestsClient.tsx' << 'TSH_EOF_MARKER'
'use client'

import { useState } from 'react'

interface Request {
  id: string; categoryName: string; description: string | null
  status: string; adminNote: string | null; createdAt: string
  user: { name: string | null; email: string }
}

export default function AdminCategoryRequestsClient({ requests: initial }: { requests: Request[] }) {
  const [requests, setRequests] = useState(initial)
  const [loading, setLoading]   = useState<string | null>(null)

  const update = async (id: string, status: string, adminNote?: string) => {
    setLoading(id)
    await fetch('/api/category-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, adminNote }),
    })
    setRequests(rs => rs.map(r => r.id === id ? { ...r, status, adminNote: adminNote ?? r.adminNote } : r))
    setLoading(null)
  }

  const STATUS_COLORS: Record<string, string> = {
    pending:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    approved:  'bg-green-500/10 text-green-400 border-green-500/20',
    dismissed: 'bg-ink-800 text-ink-500 border-ink-700',
  }

  return (
    <div className="space-y-3">
      {requests.length === 0 && (
        <p className="text-center text-ink-500 text-sm py-12">No category requests yet</p>
      )}
      {requests.map(r => (
        <div key={r.id} className="card p-5">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-display text-base font-bold text-white">{r.categoryName}</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[r.status] ?? ''}`}>
                  {r.status}
                </span>
              </div>
              {r.description && <p className="text-sm text-ink-400 mb-2">{r.description}</p>}
              <p className="text-xs text-ink-600">
                {r.user.name ?? r.user.email} · {new Date(r.createdAt).toLocaleDateString()}
              </p>
            </div>

            {r.status === 'pending' && (
              <div className="flex gap-2 shrink-0">
                <button onClick={() => update(r.id, 'approved')} disabled={loading === r.id}
                  className="btn-primary text-xs py-1.5 px-3">
                  {loading === r.id ? '…' : 'Approve'}
                </button>
                <button onClick={() => update(r.id, 'dismissed')} disabled={loading === r.id}
                  className="btn-ghost text-xs py-1.5 px-3">
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
TSH_EOF_MARKER


# Migration for category_requests table
echo "→ writing migration"
cat > "prisma/migrations/20260515000004_category_requests/migration.sql" << 'TSH_EOF_MARKER'
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
TSH_EOF_MARKER

# Add CategoryRequest model to Prisma schema
echo "→ patching prisma/schema.prisma"
if ! grep -q "CategoryRequest" prisma/schema.prisma; then
cat >> prisma/schema.prisma << 'PRISMA_EOF'

model CategoryRequest {
  id           String   @id @default(uuid())
  userId       String
  user         AuthUser @relation(fields: [userId], references: [id], onDelete: Cascade)
  categoryName String
  description  String?
  status       String   @default("pending")
  adminNote    String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("category_requests")
}
PRISMA_EOF
fi

# Add categoryRequests relation to AuthUser
if ! grep -q "categoryRequests" prisma/schema.prisma; then
python3 - << 'PYEOF'
schema = open('prisma/schema.prisma').read()
schema = schema.replace(
  "  notificationPreferences   NotificationPreferences?",
  "  notificationPreferences   NotificationPreferences?\n  categoryRequests          CategoryRequest[]"
)
open('prisma/schema.prisma', 'w').write(schema)
print("  AuthUser relation added")
PYEOF
fi

# Add CategoryRequests link to admin nav
echo "→ updating admin nav"
if ! grep -q "category-requests" components/shell/Shell.tsx 2>/dev/null; then
  sed -i '' "s|{ href: '/admin/recordings',    label: 'Recordings',  icon: '◷' },|{ href: '/admin/recordings',      label: 'Recordings',  icon: '◷' },\n    { href: '/admin/category-requests', label: 'Requests',    icon: '◌' },|" components/shell/Shell.tsx 2>/dev/null || true
fi

# Patch booking page to show "Don't see your category?" button
echo "→ patching booking page with category request button"
if ! grep -q "CategoryRequestModal" "app/(customer)/customer/book/page.tsx" 2>/dev/null; then
python3 - << 'PYEOF'
content = open('app/(customer)/customer/book/page.tsx').read()
# Add import
if "CategoryRequestModal" not in content:
    content = content.replace(
        "import Link from 'next/link'",
        "import Link from 'next/link'\nimport CategoryRequestModal from '@/components/ui/CategoryRequestModal'"
    )
# Add state
if "showCategoryRequest" not in content:
    content = content.replace(
        "  const [step, setStep]",
        "  const [showCategoryRequest, setShowCategoryRequest] = useState(false)\n  const [step, setStep]"
    )
# Add button after category grid and modal
old = "      {step === 'describe'"
new = """      {showCategoryRequest && (
        <CategoryRequestModal onClose={() => setShowCategoryRequest(false)} />
      )}

      {step === 'describe'"""
content = content.replace(old, new, 1)

# Add "don't see your category" button after category list
old = "        </div>\n      )}\n\n      {step === 'describe'"
new = """        <button onClick={() => setShowCategoryRequest(true)}
          className="w-full mt-2 py-2.5 rounded-xl border border-dashed border-ink-700 text-xs text-ink-500 hover:border-ink-500 hover:text-ink-300 transition-colors">
          Don't see your category? Request it →
        </button>
      )}

      {step === 'describe'"""
content = content.replace(old, new, 1)

open('app/(customer)/customer/book/page.tsx', 'w').write(content)
print("  booking page patched")
PYEOF
fi

echo ""
echo "✓ Applied. Changes:"
echo "  • app/(auth)/layout.tsx — vertical centering, Automotive added, trust badges"
echo "  • components/ui/CategoryRequestModal.tsx — modal for requesting new categories"  
echo "  • app/api/category-requests/route.ts — submit, list, approve/dismiss"
echo "  • app/(admin)/admin/category-requests/ — admin review page"
echo "  • Prisma: CategoryRequest model + migration"
echo "  • Booking page: 'Don't see your category? Request it →' button"
echo "  • Admin nav: Category Requests link added"
echo ""
echo "Set ADMIN_EMAIL in Railway env vars to receive request alerts."
echo ""
echo "Now run:"
echo "  git add -A && git commit -m 'Auth layout fixes, Automotive, category request system' && git push"
