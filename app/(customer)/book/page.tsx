'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Step = 'category' | 'describe' | 'photos' | 'confirm' | 'booking'

interface Category { id: string; name: string; icon: string; slug: string; fee_type: string; fee_value: number; rate_min: number; rate_max: number }
interface Expert   { id: string; full_name: string; hourly_rate: number; rating_avg: number; rating_count: number; bio: string }

export default function BookPage() {
  const router   = useRouter()
  const params   = useSearchParams()
  const supabase = createClient()

  const [step, setStep]         = useState<Step>('category')
  const [categories, setCategories] = useState<Category[]>([])
  const [experts, setExperts]   = useState<Expert[]>([])
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
    supabase.from('categories').select('*').eq('active', true).order('sort_order')
      .then(({ data }) => setCategories(data ?? []))
  }, [])

  useEffect(() => {
    if (!selected.category) return
    supabase.from('expert_profiles')
      .select('id, hourly_rate, rating_avg, rating_count, bio, profiles(full_name)')
      .eq('status', 'approved')
      .eq('available', true)
      .contains('category_ids', [selected.category.id])
      .then(({ data }) => {
        setExperts((data ?? []).map((e: any) => ({
          ...e, full_name: e.profiles?.full_name ?? 'Expert',
        })))
      })
  }, [selected.category])

  // Recalculate pricing whenever category, expert, or duration changes
  useEffect(() => {
    if (!selected.category || !selected.expert) { setPricing({ subtotal: 0, fee: 0, total: 0 }); return }
    const sub = parseFloat((selected.expert.hourly_rate * selected.duration / 60).toFixed(2))
    let fee = 0
    if (selected.category.fee_type === 'percentage') {
      fee = parseFloat((sub * selected.category.fee_value).toFixed(2))
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

    // Upload pre-session photos
    if (selected.photos.length > 0) {
      await Promise.all(selected.photos.map(async file => {
        const urlRes = await fetch('/api/photos/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: data.session.id, stage: 'pre', fileName: file.name, contentType: file.type }),
        })
        const { uploadUrl, storagePath } = await urlRes.json()
        await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
        await supabase.from('session_photos').insert({
          session_id: data.session.id, uploaded_by: data.session.customer_id,
          stage: 'pre', storage_path: storagePath, file_name: file.name,
          file_size_bytes: file.size, mime_type: file.type,
        })
      }))
    }

    router.push(`/customer/sessions/${data.session.id}`)
  }

  const DURATIONS = [15, 30, 45, 60, 90, 120]

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {(['category','describe','photos','confirm'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all
              ${step === s ? 'bg-brand-500 text-white' : i < ['category','describe','photos','confirm'].indexOf(step) ? 'bg-brand-500/30 text-brand-400' : 'bg-ink-800 text-ink-500'}`}>
              {i + 1}
            </div>
            {i < 3 && <div className={`flex-1 h-px w-8 ${i < ['category','describe','photos','confirm'].indexOf(step) ? 'bg-brand-500/40' : 'bg-ink-800'}`} />}
          </div>
        ))}
      </div>

      {/* Step: Category */}
      {step === 'category' && (
        <div className="animate-fade-up">
          <h1 className="font-display text-2xl font-bold text-white mb-2">What needs fixing?</h1>
          <p className="text-ink-400 text-sm mb-6">Choose a category to find available experts</p>
          <div className="grid grid-cols-2 gap-3">
            {categories.map(cat => (
              <button key={cat.id} onClick={() => { setSelected(s => ({ ...s, category: cat })); setStep('describe') }}
                className="card p-4 text-left hover:border-brand-500/40 transition-all">
                <p className="text-sm font-medium text-white mb-1">{cat.name}</p>
                <p className="text-xs text-ink-500">${cat.rate_min}–${cat.rate_max}/hr</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step: Describe + pick expert + duration */}
      {step === 'describe' && (
        <div className="animate-fade-up space-y-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-white mb-1">Describe the problem</h1>
            <p className="text-ink-400 text-sm">The more detail the better</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="label">Title</label>
              <input className="input" placeholder="e.g. Kitchen sink is leaking under cabinet"
                value={selected.title} onChange={e => setSelected(s => ({ ...s, title: e.target.value }))} />
            </div>
            <div>
              <label className="label">Details</label>
              <textarea className="input min-h-[100px] resize-none" placeholder="Describe what's happening, when it started, what you've tried…"
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
              ? <p className="text-ink-500 text-sm">No experts available right now — check back soon.</p>
              : (
                <div className="space-y-2">
                  {experts.map(exp => (
                    <button key={exp.id} onClick={() => setSelected(s => ({ ...s, expert: exp }))}
                      className={`w-full card p-4 text-left transition-all
                        ${selected.expert?.id === exp.id ? 'border-brand-500/60 bg-brand-500/5' : 'hover:border-ink-700'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-white">{exp.full_name}</p>
                        <p className="text-sm font-medium text-brand-400">${exp.hourly_rate}/hr</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-ink-500">
                        <span>★ {exp.rating_avg?.toFixed(1) ?? '—'} ({exp.rating_count} reviews)</span>
                      </div>
                      {exp.bio && <p className="text-xs text-ink-400 mt-2 line-clamp-2">{exp.bio}</p>}
                    </button>
                  ))}
                </div>
              )
            }
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('category')} className="btn-ghost">← Back</button>
            <button onClick={() => setStep('photos')} disabled={!selected.title || !selected.expert}
              className="btn-primary flex-1">Continue</button>
          </div>
        </div>
      )}

      {/* Step: Photos */}
      {step === 'photos' && (
        <div className="animate-fade-up space-y-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-white mb-1">Add photos</h1>
            <p className="text-ink-400 text-sm">Help your expert arrive prepared (optional, up to 6)</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {selected.photos.map((f, i) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden bg-ink-800 relative">
                <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                <button onClick={() => setSelected(s => ({ ...s, photos: s.photos.filter((_, j) => j !== i) }))}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full text-white text-xs flex items-center justify-center">
                  ×
                </button>
              </div>
            ))}
            {selected.photos.length < 6 && (
              <label className="aspect-square rounded-xl border border-dashed border-ink-700 flex items-center justify-center cursor-pointer hover:border-ink-500 transition-colors">
                <span className="text-3xl text-ink-600">+</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoAdd} />
              </label>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep('describe')} className="btn-ghost">← Back</button>
            <button onClick={() => setStep('confirm')} className="btn-primary flex-1">Continue</button>
          </div>
        </div>
      )}

      {/* Step: Confirm */}
      {step === 'confirm' && selected.category && selected.expert && (
        <div className="animate-fade-up space-y-5">
          <h1 className="font-display text-2xl font-bold text-white mb-1">Confirm booking</h1>
          <div className="card p-5 space-y-3">
            <Row label="Expert"    value={selected.expert.full_name} />
            <Row label="Category"  value={selected.category.name} />
            <Row label="Duration"  value={selected.duration < 60 ? `${selected.duration} min` : `${selected.duration / 60} hr`} />
            <Row label="Problem"   value={selected.title} />
            <div className="border-t border-ink-800 pt-3 mt-3 space-y-2">
              <Row label="Session subtotal" value={`$${pricing.subtotal.toFixed(2)}`} />
              <Row label="Service fee"      value={`$${pricing.fee.toFixed(2)}`} muted />
              <div className="flex justify-between items-baseline pt-1">
                <span className="text-sm font-medium text-white">Total charged after session</span>
                <span className="text-lg font-bold text-brand-400">${pricing.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {selected.photos.length > 0 && (
            <div className="flex gap-2">
              {selected.photos.map((f, i) => (
                <img key={i} src={URL.createObjectURL(f)} alt="" className="w-14 h-14 rounded-lg object-cover" />
              ))}
              <p className="text-xs text-ink-500 self-center ml-1">{selected.photos.length} photo{selected.photos.length !== 1 ? 's' : ''} attached</p>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep('photos')} className="btn-ghost">← Back</button>
            <button onClick={handleBook} disabled={loading} className="btn-primary flex-1 py-3">
              {loading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : `Book session · $${pricing.total.toFixed(2)}`}
            </button>
          </div>
          <p className="text-xs text-ink-600 text-center">Payment is held and only charged when the session completes</p>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-xs text-ink-500">{label}</span>
      <span className={`text-sm ${muted ? 'text-ink-400' : 'text-ink-200'}`}>{value}</span>
    </div>
  )
}
