'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import CategoryRequestModal from '@/components/ui/CategoryRequestModal'
import { DurationSelector } from '@/components/booking/DurationSelector'

type Step = 'category' | 'describe' | 'photos' | 'confirm' | 'booking'

interface Category { id: string; name: string; icon: string; slug: string; fee_type: string; fee_value: number; fee_flat_tiers?: Record<string,number>; rate_min: number; rate_max: number }
interface Expert   { id: string; name: string; hourlyRate: number; ratingAvg: number; ratingCount: number; bio: string }
interface SavedCard { id: string; brand: string; last4: string; expMonth: number; expYear: number; isDefault: boolean }

export default function BookPage() {
  const router   = useRouter()
  const params   = useSearchParams()

  const [showCategoryRequest, setShowCategoryRequest] = useState(false)
  const [step, setStep]         = useState<Step>('category')
  const [categories, setCategories] = useState<Category[]>([])
  const [experts, setExperts]   = useState<Expert[]>([])
  const [savedCards, setSavedCards] = useState<SavedCard[]>([])
  const [hasCard, setHasCard]   = useState<boolean | null>(null)
  const [selected, setSelected] = useState({
    category: null as Category | null,
    expert:   null as Expert | null,
    duration: 30,
    title:    '',
    desc:     '',
    photos:   [] as File[],
  })
  const [pricing, setPricing]   = useState({ subtotal: 0, fee: 0, total: 0 })
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    // Load categories and check for saved payment method in parallel
    Promise.all([
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/payments/methods').then(r => r.json()),
    ]).then(([catData, pmData]) => {
      setCategories(catData.categories ?? [])
      setSavedCards(pmData.methods ?? [])
      setHasCard((pmData.methods ?? []).length > 0)
    })
  }, [])

  useEffect(() => {
    if (!selected.category) return
    fetch(`/api/experts?categoryId=${selected.category.id}`)
      .then(r => r.json())
      .then(d => setExperts(d.experts ?? []))
  }, [selected.category])

  useEffect(() => {
    if (!selected.category || !selected.expert) { setPricing({ subtotal: 0, fee: 0, total: 0 }); return }
    const sub = parseFloat((selected.expert.hourlyRate * selected.duration / 60).toFixed(2))
    let fee = 0
    if (selected.category.fee_type === 'percentage') {
      fee = parseFloat((sub * selected.category.fee_value).toFixed(2))
    } else {
      const tiers = selected.category.fee_flat_tiers ?? {}
      const tierKey = [15,30,45,60,75,90,105,120].find(t => t >= selected.duration) ?? 120
      fee = tiers[String(tierKey)] ?? 0
    }
    setPricing({ subtotal: sub, fee, total: parseFloat((sub + fee).toFixed(2)) })
  }, [selected.category, selected.expert, selected.duration])

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    setSelected(s => ({ ...s, photos: [...s.photos, ...files].slice(0, 6) }))
  }

  const handleBook = async () => {
    if (!selected.category || !selected.expert) return
    setLoading(true); setError(null)

    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertId:           selected.expert.id,
        categoryId:         selected.category.id,
        durationMinutes:    selected.duration,
        problemTitle:       selected.title,
        problemDescription: selected.desc,
      }),
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Booking failed'); setLoading(false); return }

    // Upload pre-session photos (photo record created by upload-url API)
    if (selected.photos.length > 0) {
      await Promise.allSettled(selected.photos.map(async file => {
        const urlRes = await fetch('/api/photos/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: data.session.id, stage: 'pre', fileName: file.name, contentType: file.type }),
        })
        const { uploadUrl } = await urlRes.json()
        if (!uploadUrl) return
        await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      }))
    }

    router.push(`/customer/sessions/${data.session.id}`)
  }

  const DURATIONS = [30, 45, 60, 90, 120]

  const defaultCard = savedCards.find(c => c.isDefault) ?? savedCards[0]

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-8">
        {(['category','describe','photos','confirm'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all
              ${step === s ? 'bg-brand-500 text-white'
                : i < ['category','describe','photos','confirm'].indexOf(step)
                ? 'bg-brand-500/30 text-brand-400' : 'bg-ink-800 text-ink-500'}`}>
              {i + 1}
            </div>
            {i < 3 && <div className={`h-px w-8 ${i < ['category','describe','photos','confirm'].indexOf(step) ? 'bg-brand-500/40' : 'bg-ink-800'}`} />}
          </div>
        ))}
      </div>

      {/* STEP: Category */}
      {step === 'category' && (
        <div className="animate-fade-up space-y-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-white mb-1">What needs fixing?</h1>
            <p className="text-ink-400 text-sm">Choose a category to find available experts</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {categories.map(cat => (
              <button key={cat.id}
                onClick={() => { setSelected(s => ({ ...s, category: cat })); setStep('describe') }}
                className="card p-4 text-left hover:border-brand-500/40 transition-all group">
                <p className="text-sm font-medium text-white group-hover:text-brand-400 transition-colors">{cat.name}</p>
                <p className="text-xs text-ink-500 mt-0.5">${(cat as any).rateMin ?? (cat as any).rate_min ?? '—'}/hr+</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP: Describe */}
      {showCategoryRequest && (
        <CategoryRequestModal onClose={() => setShowCategoryRequest(false)} />
      )}

      {step === 'describe' && (
        <div className="animate-fade-up space-y-5">
          <h1 className="font-display text-2xl font-bold text-white">Describe the problem</h1>
          <div className="space-y-4">
            <div>
              <label className="label">Title</label>
              <input className="input" placeholder="e.g. Kitchen sink leaking under cabinet"
                value={selected.title} onChange={e => setSelected(s => ({ ...s, title: e.target.value }))} />
            </div>
            <div>
              <label className="label">Details</label>
              <textarea className="input min-h-[90px] resize-none" placeholder="What's happening, when it started, what you've tried…"
                value={selected.desc} onChange={e => setSelected(s => ({ ...s, desc: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="label">Session length</label>
            <div className="flex gap-2 flex-wrap">
              {DURATIONS.map(d => (
                <button key={d} onClick={() => setSelected(s => ({ ...s, duration: d }))}
                  className={`px-4 py-2 rounded-lg text-sm border transition-all
                    ${selected.duration === d ? 'bg-brand-500 border-brand-500 text-white' : 'border-ink-700 text-ink-400 hover:border-ink-500'}`}>
                  {d < 60 ? `${d}m` : `${d / 60}h`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Choose an expert</label>
            {experts.length === 0
              ? <p className="text-ink-500 text-sm card p-4">No experts available in this category right now — check back soon.</p>
              : (
                <div className="space-y-2">
                  {experts.map(exp => (
                    <button key={exp.id} onClick={() => setSelected(s => ({ ...s, expert: exp }))}
                      className={`w-full card p-4 text-left transition-all
                        ${selected.expert?.id === exp.id ? 'border-brand-500/60 bg-brand-500/5' : 'hover:border-ink-700'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-white">{exp.name}</p>
                        <p className="text-sm font-medium text-brand-400">${exp.hourlyRate}/hr</p>
                      </div>
                      <p className="text-xs text-ink-500">★ {exp.ratingAvg?.toFixed(1) ?? '—'} ({exp.ratingCount ?? 0} reviews)</p>
                      {exp.bio && <p className="text-xs text-ink-400 mt-1.5 line-clamp-2">{exp.bio}</p>}
                    </button>
                  ))}
                </div>
              )
            }
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('category')} className="btn-ghost">← Back</button>
            <button onClick={() => setStep('photos')} disabled={!selected.title || !selected.desc}
              className="btn-primary flex-1">Continue</button>
          </div>
        </div>
      )}

      {/* STEP: Photos */}
      {step === 'photos' && (
        <div className="animate-fade-up space-y-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-white mb-1">Add photos</h1>
            <p className="text-ink-400 text-sm">Help your expert prepare (optional, up to 6)</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {selected.photos.map((f, i) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden bg-ink-800 relative">
                <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                <button onClick={() => setSelected(s => ({ ...s, photos: s.photos.filter((_, j) => j !== i) }))}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full text-white text-xs flex items-center justify-center">
                  ×
                </button>
              </div>
            ))}
            {selected.photos.length < 6 && (
              <label className="aspect-square rounded-xl border border-dashed border-ink-700 flex items-center justify-center cursor-pointer hover:border-ink-500 transition-colors">
                <span className="text-3xl text-ink-600">+</span>
                <input type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={handlePhotoAdd} />
              </label>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep('describe')} className="btn-ghost">← Back</button>
            <button onClick={() => setStep('confirm')} className="btn-primary flex-1">Continue</button>
          </div>
        </div>
      )}

      {/* STEP: Confirm */}
      {step === 'confirm' && selected.category && selected.expert && (
        <div className="animate-fade-up space-y-4">
          <h1 className="font-display text-2xl font-bold text-white">Confirm booking</h1>

          {/* Booking summary */}
          <div className="card p-5 space-y-2.5">
            {[
              ['Expert',   selected.expert.name],
              ['Category', selected.category.name],
              ['Duration', selected.duration < 60 ? `${selected.duration} min` : `${selected.duration / 60} hr`],
              ['Problem',  selected.title],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between text-sm">
                <span className="text-ink-500">{l}</span>
                <span className="text-ink-200">{v}</span>
              </div>
            ))}
            <div className="border-t border-ink-800 pt-2.5 space-y-2 mt-2">
              <div className="flex justify-between text-sm">
                <span className="text-ink-500">Session subtotal</span>
                <span>${pricing.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-500">Service fee</span>
                <span className="text-ink-400">${pricing.fee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-medium border-t border-ink-800 pt-2">
                <span>Charged after session</span>
                <span className="text-brand-400 text-lg">${pricing.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Payment method */}
          {hasCard === false ? (
            <div className="card p-5 border-yellow-500/30 bg-yellow-500/5">
              <p className="text-sm font-medium text-yellow-300 mb-1">No payment method saved</p>
              <p className="text-xs text-ink-400 mb-3">You need to add a card before booking a session.</p>
              <Link href="/customer/payment-methods" className="btn-primary text-sm py-2 inline-block">
                Add a card
              </Link>
            </div>
          ) : defaultCard ? (
            <div className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">💳</span>
                <div>
                  <p className="text-sm text-ink-200 capitalize">{defaultCard.brand} ···· {defaultCard.last4}</p>
                  <p className="text-xs text-ink-500">Payment held, charged after session</p>
                </div>
              </div>
              <Link href="/customer/payment-methods" className="text-xs text-brand-400 hover:text-brand-300">Change</Link>
            </div>
          ) : null}

          {/* Photos preview */}
          {selected.photos.length > 0 && (
            <div className="flex gap-2 items-center">
              {selected.photos.map((f, i) => (
                <img key={i} src={URL.createObjectURL(f)} alt="" className="w-12 h-12 rounded-lg object-cover" />
              ))}
              <p className="text-xs text-ink-500 ml-1">{selected.photos.length} photo{selected.photos.length !== 1 ? 's' : ''} attached</p>
            </div>
          )}

          {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3">
            <button onClick={() => setStep('photos')} className="btn-ghost">← Back</button>
            <button onClick={handleBook} disabled={loading || !hasCard} className="btn-primary flex-1 py-3">
              {loading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : `Book · $${pricing.total.toFixed(2)}`}
            </button>
          </div>
          <p className="text-xs text-ink-600 text-center">Your card is held now and charged only when the session completes.</p>
        </div>
      )}
    </div>
  )
}
