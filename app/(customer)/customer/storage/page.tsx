'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const PLANS = [
  {
    id:    'free',
    name:  'Free',
    price: '$0/mo',
    gb:    null,
    perks: ['30-day recording access', '100MB photo storage', 'No downloads'],
  },
  {
    id:    'basic',
    name:  'Basic',
    price: '$6/mo',
    gb:    10,
    perks: ['10 GB storage (~15 hrs)', '500MB photos', 'Keep recordings forever', 'Download recordings'],
    popular: true,
  },
  {
    id:    'pro',
    name:  'Pro',
    price: '$15/mo',
    gb:    50,
    perks: ['50 GB storage (~75 hrs)', '5GB photos', 'Keep recordings forever', 'Download recordings', 'Priority support'],
  },
  {
    id:    'unlimited',
    name:  'Unlimited',
    price: '$29/mo',
    gb:    -1,
    perks: ['Unlimited storage', 'Unlimited photos', 'Keep recordings forever', 'Download recordings', 'Priority + phone support'],
  },
]

export default function StoragePage() {
  const router = useRouter()
  const [currentTier, setCurrentTier] = useState<string | null>(null)
  const [usedBytes, setUsedBytes]     = useState(0)
  const [loading, setLoading]         = useState(true)
  const [managing, setManaging]       = useState(false)

  useEffect(() => {
    fetch('/api/customer/storage')
      .then(r => r.json())
      .then(d => {
        setCurrentTier(d.tier ?? 'free')
        setUsedBytes(d.usedBytes ?? 0)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const manageSubscription = async () => {
    setManaging(true)
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const { url } = await res.json()
    window.location.href = url
  }

  const fmt = (bytes: number) =>
    bytes > 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${(bytes / 1e6).toFixed(0)} MB`

  if (loading) return (
    <div className="p-8 flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Storage &amp; recordings</h1>
          <p className="text-ink-400 text-sm mt-1">
            Using {fmt(usedBytes)}
            {currentTier && currentTier !== 'free'
              ? ` of ${PLANS.find(p => p.id === currentTier)?.gb === -1 ? 'unlimited' : `${PLANS.find(p => p.id === currentTier)?.gb}GB`}`
              : ' (free tier)'}
          </p>
        </div>
        {currentTier && currentTier !== 'free' && (
          <button onClick={manageSubscription} disabled={managing} className="btn-ghost text-sm">
            {managing ? 'Opening…' : 'Manage subscription'}
          </button>
        )}
      </div>

      {/* Usage bar */}
      {currentTier !== 'free' && currentTier !== 'unlimited' && (
        <div className="card p-4 mb-6">
          <div className="flex justify-between text-xs text-ink-400 mb-2">
            <span>Storage used</span>
            <span>{fmt(usedBytes)}</span>
          </div>
          <div className="h-2 bg-ink-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all"
              style={{
                width: `${Math.min(100, (usedBytes / ((PLANS.find(p => p.id === currentTier)?.gb ?? 1) * 1e9)) * 100)}%`
              }}
            />
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map(plan => {
          const isCurrent = currentTier === plan.id || (!currentTier && plan.id === 'free')
          return (
            <div key={plan.id} className={`card p-5 relative ${plan.popular ? 'border-brand-500/40' : ''} ${isCurrent ? 'bg-ink-800/50' : ''}`}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-[10px] font-medium px-3 py-1 rounded-full">
                  Most popular
                </div>
              )}
              <div className="mb-4">
                <p className="text-sm font-medium text-white">{plan.name}</p>
                <p className="font-display text-xl font-bold text-white mt-0.5">{plan.price}</p>
                {plan.gb && <p className="text-xs text-ink-500 mt-0.5">{plan.gb === -1 ? 'Unlimited' : `${plan.gb} GB`}</p>}
              </div>
              <ul className="space-y-1.5 mb-4">
                {plan.perks.map(p => (
                  <li key={p} className="flex items-start gap-1.5 text-xs text-ink-400">
                    <span className="text-brand-500 mt-0.5 shrink-0">✓</span>{p}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <div className="text-center text-xs text-ink-500 py-2 border border-ink-700 rounded-lg">Current plan</div>
              ) : plan.id === 'free' ? (
                <button onClick={manageSubscription} disabled={managing}
                  className="w-full text-xs py-2 border border-ink-700 rounded-lg text-ink-400 hover:border-ink-500 transition-colors">
                  Downgrade
                </button>
              ) : (
                <button onClick={manageSubscription} disabled={managing}
                  className={`w-full text-sm py-2 rounded-lg font-medium transition-colors ${plan.popular ? 'btn-primary' : 'btn-ghost'}`}>
                  {managing ? '…' : 'Upgrade'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-ink-600 mt-6 text-center">
        Manage billing, download invoices, and cancel anytime via the Stripe billing portal.
      </p>
    </div>
  )
}
