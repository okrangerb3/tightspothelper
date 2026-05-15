#!/usr/bin/env bash
# Force replace CategoryEditor and categories page + set default fee to 5%
set -e
if [ ! -f package.json ] || ! grep -q "tightspothelper" package.json 2>/dev/null; then
  echo "⚠️  Run from the repo root." >&2; exit 1
fi
mkdir -p app/api/admin/categories
echo '→ writing CategoryEditor.tsx'
cat > 'app/(admin)/admin/categories/CategoryEditor.tsx' << 'TSH_EOF_MARKER'
'use client'

import { useState } from 'react'

interface Category {
  id: string
  name: string
  slug: string
  feeType: string
  feeValue: number
  feeFlatTiers: Record<string, number> | null
  active: boolean
  icon?: string | null
  description?: string | null
}

const DURATION_TIERS = [15, 30, 45, 60, 75, 90, 105, 120]

const ICONS = [
  { value: 'ti-droplet',    label: '💧 Plumbing' },
  { value: 'ti-bolt',       label: '⚡ Electrical' },
  { value: 'ti-wind',       label: '❄️ HVAC' },
  { value: 'ti-tool',       label: '🔧 Appliances' },
  { value: 'ti-hammer',     label: '🔨 Handyman' },
  { value: 'ti-car',        label: '🚗 Automotive' },
  { value: 'ti-washing-machine', label: '🧺 Laundry' },
  { value: 'ti-plant',      label: '🌿 Landscaping' },
  { value: 'ti-home',       label: '🏠 General' },
  { value: 'ti-fish',       label: '⛵ Marine' },
]

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function CategoryEditor({ categories: initial }: { categories: Category[] }) {
  const [cats, setCats]     = useState(initial)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved,  setSaved]  = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newCat, setNewCat] = useState({
    name: '', slug: '', description: '', icon: 'ti-home',
    feeType: 'percentage', feeValue: 0.20, active: true,
  })

  const update = (id: string, patch: Partial<Category>) =>
    setCats(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c))

  const save = async (cat: Category) => {
    setSaving(cat.id)
    const res = await fetch(`/api/admin/categories/${cat.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fee_type:       cat.feeType,
        fee_value:      cat.feeValue,
        fee_flat_tiers: cat.feeFlatTiers,
        active:         cat.active,
        icon:           cat.icon,
        description:    cat.description,
      }),
    })
    setSaving(null)
    if (res.ok) { setSaved(cat.id); setTimeout(() => setSaved(null), 2000) }
  }

  const create = async () => {
    if (!newCat.name.trim()) return
    setCreating(true)
    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:        newCat.name.trim(),
        slug:        newCat.slug || slugify(newCat.name),
        description: newCat.description || null,
        icon:        newCat.icon,
        fee_type:    newCat.feeType,
        fee_value:   newCat.feeValue,
        active:      newCat.active,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setCats(cs => [...cs, { ...data.category, feeValue: Number(data.category.feeValue), feeFlatTiers: null }])
      setNewCat({ name: '', slug: '', description: '', icon: 'ti-home', feeType: 'percentage', feeValue: 0.20, active: true })
      setShowNew(false)
    }
    setCreating(false)
  }

  return (
    <div className="space-y-4">

      {/* Add new category button */}
      <div className="flex justify-end">
        <button onClick={() => setShowNew(v => !v)} className="btn-primary text-sm">
          {showNew ? '✕ Cancel' : '+ Add category'}
        </button>
      </div>

      {/* New category form */}
      {showNew && (
        <div className="card p-6 border-brand-500/30 space-y-4">
          <h3 className="font-display text-base font-bold text-white">New category</h3>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Name *</label>
              <input value={newCat.name} className="input"
                placeholder="e.g. Pool & Spa"
                onChange={e => setNewCat(n => ({ ...n, name: e.target.value, slug: slugify(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Slug</label>
              <input value={newCat.slug} className="input"
                placeholder="pool-spa"
                onChange={e => setNewCat(n => ({ ...n, slug: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <input value={newCat.description} className="input"
              placeholder="Short description shown to customers"
              onChange={e => setNewCat(n => ({ ...n, description: e.target.value }))} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Icon</label>
              <select value={newCat.icon} className="input"
                onChange={e => setNewCat(n => ({ ...n, icon: e.target.value }))}>
                {ICONS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Platform fee type</label>
              <div className="flex gap-2 mt-1.5">
                {['percentage', 'flat'].map(t => (
                  <button key={t} onClick={() => setNewCat(n => ({ ...n, feeType: t }))}
                    className={`flex-1 py-2 rounded-lg text-xs border capitalize transition-all
                      ${newCat.feeType === t ? 'bg-brand-500 border-brand-500 text-white' : 'border-ink-700 text-ink-400'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {newCat.feeType === 'percentage' && (
            <div>
              <label className="label">Platform cut — {Math.round(newCat.feeValue * 100)}%</label>
              <input type="range" min={0.05} max={0.50} step={0.01} value={newCat.feeValue}
                onChange={e => setNewCat(n => ({ ...n, feeValue: parseFloat(e.target.value) }))}
                className="w-full" />
              <div className="flex justify-between text-[10px] text-ink-600 mt-1"><span>5%</span><span>50%</span></div>
            </div>
          )}

          <button onClick={create} disabled={creating || !newCat.name.trim()}
            className="btn-primary w-full">
            {creating ? 'Creating…' : 'Create category'}
          </button>
        </div>
      )}

      {/* Existing categories */}
      {cats.map(cat => (
        <div key={cat.id} className={`card p-5 transition-all ${!cat.active ? 'opacity-60' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {cat.icon && <i className={`${cat.icon} text-brand-400`} />}
              <h3 className="font-display text-base font-bold text-white">{cat.name}</h3>
              <button onClick={() => update(cat.id, { active: !cat.active })}
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-all
                  ${cat.active
                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                    : 'bg-ink-800 text-ink-500 border-ink-700'}`}>
                {cat.active ? 'Active' : 'Inactive'}
              </button>
            </div>
            <button onClick={() => save(cat)} disabled={saving === cat.id}
              className="btn-primary text-xs py-1.5 px-4">
              {saving === cat.id ? '…' : saved === cat.id ? '✓ Saved' : 'Save'}
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Platform fee type</label>
              <div className="flex gap-2">
                {['percentage', 'flat'].map(t => (
                  <button key={t} onClick={() => update(cat.id, { feeType: t })}
                    className={`flex-1 py-2 rounded-lg text-xs border capitalize transition-all
                      ${cat.feeType === t ? 'bg-brand-500 border-brand-500 text-white' : 'border-ink-700 text-ink-400 hover:border-ink-500'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {cat.feeType === 'percentage' && (
              <div>
                <label className="label">Platform cut — {Math.round(cat.feeValue * 100)}%</label>
                <input type="range" min={0.05} max={0.50} step={0.01} value={cat.feeValue}
                  onChange={e => update(cat.id, { feeValue: parseFloat(e.target.value) })}
                  className="w-full mt-2" />
                <div className="flex justify-between text-[10px] text-ink-600 mt-1"><span>5%</span><span>50%</span></div>
              </div>
            )}

            {cat.feeType === 'flat' && (
              <div>
                <label className="label">Flat fee by duration</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {DURATION_TIERS.map(mins => (
                    <div key={mins}>
                      <p className="text-[10px] text-ink-600 mb-0.5 text-center">{mins}m</p>
                      <input type="number" min={0} max={100} step={0.5}
                        value={cat.feeFlatTiers?.[String(mins)] ?? ''}
                        onChange={e => update(cat.id, {
                          feeFlatTiers: { ...(cat.feeFlatTiers ?? {}), [String(mins)]: parseFloat(e.target.value) || 0 }
                        })}
                        className="input text-center text-xs py-1.5 px-1" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {cat.feeType === 'percentage' && (
            <div className="mt-4 surface p-3 rounded-xl">
              <p className="text-[10px] text-ink-500 mb-2">Fee preview (example $75/hr pro rate)</p>
              <div className="flex gap-4 text-xs">
                {[30, 60, 90].map(mins => {
                  const sub = 75 * mins / 60
                  const fee = sub * cat.feeValue
                  return (
                    <div key={mins}>
                      <p className="text-ink-500">{mins}m</p>
                      <p className="text-white">${(sub + fee).toFixed(2)}</p>
                      <p className="text-brand-400">fee ${fee.toFixed(2)}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
TSH_EOF_MARKER

echo '→ writing categories/page.tsx'
cat > 'app/(admin)/admin/categories/page.tsx' << 'TSH_EOF_MARKER'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import CategoryEditor from './CategoryEditor'
import Link from 'next/link'

export const metadata = { title: 'Categories — TightSpotHelper Admin' }

export default async function AdminCategories() {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')
  if ((session.user as any).role !== 'admin') redirect('/customer/dashboard')

  const [rawCats, pendingRequests] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }),
    (prisma as any).categoryRequest.count({ where: { status: 'pending' } }),
  ])

  const categories = rawCats.map(c => ({
    id:           c.id,
    name:         c.name,
    slug:         c.slug,
    description:  c.description ?? null,
    icon:         c.icon ?? null,
    feeType:      c.feeType,
    feeValue:     Number(c.feeValue),
    feeFlatTiers: c.feeFlatTiers as Record<string, number> | null,
    active:       c.active,
  }))

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Categories</h1>
          <p className="text-ink-400 text-sm mt-1">
            Manage service categories and platform fees. Pros set their own rates.
          </p>
        </div>
        {pendingRequests > 0 && (
          <Link href="/admin/category-requests"
            className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20
              text-yellow-400 text-xs font-medium px-3 py-2 rounded-xl hover:bg-yellow-500/20 transition-colors">
            <span className="w-4 h-4 bg-yellow-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
              {pendingRequests}
            </span>
            Pending requests
          </Link>
        )}
      </div>
      <CategoryEditor categories={categories} />
    </div>
  )
}
TSH_EOF_MARKER

echo '→ writing api/admin/categories/route.ts'
cat > 'app/api/admin/categories/route.ts' << 'TSH_EOF_MARKER'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if ((session.user as any).role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, slug, description, icon, fee_type, fee_value, active } = await req.json()

  if (!name?.trim() || !slug?.trim())
    return NextResponse.json({ error: 'Name and slug required' }, { status: 400 })

  // Check for duplicate
  const existing = await prisma.category.findFirst({
    where: { OR: [{ name }, { slug }] },
  })
  if (existing)
    return NextResponse.json({ error: 'Category name or slug already exists' }, { status: 409 })

  const category = await prisma.category.create({
    data: {
      name,
      slug,
      description:  description ?? null,
      icon:         icon ?? null,
      feeType:      fee_type ?? 'percentage',
      feeValue:     fee_value ?? 0.20,
      active:       active ?? true,
      sortOrder:    999,
    },
  })

  return NextResponse.json({ category })
}
TSH_EOF_MARKER


# Fix missing Stripe exports
if ! grep -q "createRecordingPurchase" lib/stripe/index.ts 2>/dev/null; then
echo "→ adding missing Stripe exports"
cat >> lib/stripe/index.ts << 'TSEOF'

export async function createRecordingPurchase(params: {
  customerId:       string
  amountCents:      number
  recordingId:      string
  paymentMethodId?: string
}) {
  const { customerId, amountCents, recordingId, paymentMethodId } = params
  return stripe.paymentIntents.create({
    amount:   amountCents,
    currency: 'usd',
    customer: customerId,
    ...(paymentMethodId ? {
      payment_method: paymentMethodId,
      confirm:        true,
      off_session:    true,
    } : {}),
    metadata:    { recordingId, type: 'recording_purchase' },
    description: `TightSpotHelper recording ${recordingId}`,
  })
}

export function verifyStripeWebhook(payload: string | Buffer, signature: string) {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!,
  )
}
TSEOF
fi

# Set all existing category fees to 5% default
echo "→ writing migration to set default fee to 5%"
mkdir -p prisma/migrations/20260515000006_default_fee_5pct
cat > prisma/migrations/20260515000006_default_fee_5pct/migration.sql << 'SQLEOF'
-- Set all percentage-type categories to 5% platform fee
UPDATE "categories"
SET "feeValue" = 0.05
WHERE "feeType" = 'percentage';
SQLEOF

echo ""
echo "✓ Done. Run:"
echo "  git add -A && git commit -m 'Fix CategoryEditor: add button, 5% default fee' && git push"
