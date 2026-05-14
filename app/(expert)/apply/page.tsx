'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

type Step = 'intro' | 'details' | 'categories' | 'rate' | 'submit'

interface Category { id: string; name: string; rateMin: number; rateMax: number }

export default function ExpertApplyPage() {
  const router = useRouter()

  const [step, setStep]   = useState<Step>('intro')
  const [cats, setCats]   = useState<Category[]>([])
  const [form, setForm]   = useState({
    bio:            '',
    years:          '',
    certifications: '',
    categoryIds:    [] as string[],
    hourlyRate:     75,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(d => setCats(d.categories ?? []))
  }, [])

  const toggleCat = (id: string) =>
    setForm(f => ({
      ...f,
      categoryIds: f.categoryIds.includes(id)
        ? f.categoryIds.filter(c => c !== id)
        : [...f.categoryIds, id],
    }))

  const handleSubmit = async () => {
    setLoading(true); setError(null)
    const session = await authClient.getSession()
    if (!session.data) { router.push('/login'); return }

    const res = await fetch('/api/expert/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bio:             form.bio,
        yearsExperience: parseInt(form.years) || 0,
        certifications:  form.certifications.split(',').map(s => s.trim()).filter(Boolean),
        categoryIds:     form.categoryIds,
        hourlyRate:      form.hourlyRate,
      }),
    })

    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Something went wrong')
      setLoading(false)
      return
    }
    router.push('/expert/apply/connect')
  }

  return (
    <div className="min-h-screen p-6 max-w-xl mx-auto">
      {step === 'intro' && (
        <div className="animate-fade-up space-y-6">
          <div>
            <div className="text-4xl mb-4">🛠️</div>
            <h1 className="font-display text-3xl font-bold text-white mb-3">Become an expert</h1>
            <p className="text-ink-400 leading-relaxed">
              Help people fix things remotely via live video. Set your own rates, work when you want.
              We run a background check on all experts before approval.
            </p>
          </div>
          <div className="card p-5 space-y-3">
            {[
              ['Background check', 'We use Checkr — takes 1–3 days'],
              ['Set your rate', 'You choose $25–$300/hr'],
              ['Get paid weekly', 'Via Stripe direct deposit'],
            ].map(([t, s]) => (
              <div key={t} className="flex items-start gap-3">
                <span className="text-brand-500 mt-0.5">✓</span>
                <div>
                  <p className="text-sm font-medium text-white">{t}</p>
                  <p className="text-xs text-ink-500">{s}</p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setStep('details')} className="btn-primary w-full py-3">
            Start application
          </button>
        </div>
      )}

      {step === 'details' && (
        <div className="animate-fade-up space-y-5">
          <h1 className="font-display text-2xl font-bold text-white">About you</h1>
          <div>
            <label className="label">Professional bio</label>
            <textarea className="input min-h-[100px] resize-none"
              placeholder="Describe your experience, specialties, and what makes you a great expert…"
              value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} />
          </div>
          <div>
            <label className="label">Years of experience</label>
            <input type="number" className="input" placeholder="5" min="0" max="50"
              value={form.years} onChange={e => setForm(f => ({ ...f, years: e.target.value }))} />
          </div>
          <div>
            <label className="label">Certifications (optional, comma-separated)</label>
            <input className="input" placeholder="Licensed Plumber, EPA 608, Master Electrician…"
              value={form.certifications} onChange={e => setForm(f => ({ ...f, certifications: e.target.value }))} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep('intro')} className="btn-ghost">← Back</button>
            <button onClick={() => setStep('categories')} disabled={!form.bio || !form.years}
              className="btn-primary flex-1">Continue</button>
          </div>
        </div>
      )}

      {step === 'categories' && (
        <div className="animate-fade-up space-y-5">
          <h1 className="font-display text-2xl font-bold text-white">Your specialties</h1>
          <p className="text-ink-400 text-sm">Select all categories you can help with</p>
          <div className="space-y-2">
            {cats.map(cat => (
              <button key={cat.id} onClick={() => toggleCat(cat.id)}
                className={`w-full card p-4 text-left transition-all
                  ${form.categoryIds.includes(cat.id) ? 'border-brand-500/60 bg-brand-500/5' : 'hover:border-ink-700'}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-white">{cat.name}</p>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-ink-500">${cat.rateMin}–${cat.rateMax}/hr</p>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all
                      ${form.categoryIds.includes(cat.id) ? 'bg-brand-500 border-brand-500' : 'border-ink-600'}`}>
                      {form.categoryIds.includes(cat.id) && <span className="text-white text-[10px]">✓</span>}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep('details')} className="btn-ghost">← Back</button>
            <button onClick={() => setStep('rate')} disabled={form.categoryIds.length === 0}
              className="btn-primary flex-1">Continue</button>
          </div>
        </div>
      )}

      {step === 'rate' && (
        <div className="animate-fade-up space-y-5">
          <h1 className="font-display text-2xl font-bold text-white">Set your rate</h1>
          <p className="text-ink-400 text-sm">This is your hourly rate. Customers pay a small platform fee on top — you keep the full amount.</p>
          <div className="card p-6 text-center">
            <p className="font-display text-5xl font-bold text-brand-400 mb-1">${form.hourlyRate}</p>
            <p className="text-ink-500 text-sm">per hour</p>
            <input type="range" min={25} max={300} step={5} value={form.hourlyRate}
              onChange={e => setForm(f => ({ ...f, hourlyRate: parseInt(e.target.value) }))}
              className="w-full mt-6" />
            <div className="flex justify-between text-xs text-ink-600 mt-1">
              <span>$25</span><span>$300</span>
            </div>
          </div>
          <div className="surface p-4 rounded-xl text-sm text-ink-400">
            <p className="text-white text-sm font-medium mb-1">What you earn per session</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span>30 min session</span><span className="text-green-400">${(form.hourlyRate * 0.5).toFixed(2)}</span></div>
              <div className="flex justify-between"><span>60 min session</span><span className="text-green-400">${form.hourlyRate.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>90 min session</span><span className="text-green-400">${(form.hourlyRate * 1.5).toFixed(2)}</span></div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep('categories')} className="btn-ghost">← Back</button>
            <button onClick={() => setStep('submit')} className="btn-primary flex-1">Review application</button>
          </div>
        </div>
      )}

      {step === 'submit' && (
        <div className="animate-fade-up space-y-5">
          <h1 className="font-display text-2xl font-bold text-white">Review &amp; submit</h1>
          <div className="card p-5 space-y-3 text-sm">
            <Row label="Rate"           value={`$${form.hourlyRate}/hr`} />
            <Row label="Experience"     value={`${form.years} years`} />
            <Row label="Categories"     value={cats.filter(c => form.categoryIds.includes(c.id)).map(c => c.name).join(', ')} />
            {form.certifications && <Row label="Certifications" value={form.certifications} />}
          </div>
          <div className="surface p-4 rounded-xl text-xs text-ink-400 leading-relaxed">
            By submitting, you agree to our Expert Terms and consent to a background check via Checkr.
            Results typically take 1–3 business days. You'll receive an email when your application is reviewed.
          </div>
          {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => setStep('rate')} className="btn-ghost">← Back</button>
            <button onClick={handleSubmit} disabled={loading} className="btn-primary flex-1 py-3">
              {loading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Submit application'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-ink-500 shrink-0">{label}</span>
      <span className="text-ink-200 text-right">{value}</span>
    </div>
  )
}

    bio:            '',
    years:          '',
    certifications: '',
    categoryIds:    [] as string[],
    hourlyRate:     75,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    supabase.from('categories').select('id,name,rate_min,rate_max').eq('active', true)
      .then(({ data }) => setCats(data ?? []))
  }, [])

  const toggleCat = (id: string) =>
    setForm(f => ({
      ...f,
      categoryIds: f.categoryIds.includes(id)
        ? f.categoryIds.filter(c => c !== id)
        : [...f.categoryIds, id],
    }))

  const handleSubmit = async () => {
    setLoading(true); setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { error } = await supabase.from('expert_profiles').upsert({
      id:             user.id,
      bio:            form.bio,
      years_experience: parseInt(form.years) || 0,
      certifications: form.certifications.split(',').map(s => s.trim()).filter(Boolean),
      category_ids:   form.categoryIds,
      hourly_rate:    form.hourlyRate,
      status:         'pending',
    })

    if (error) { setError(error.message); setLoading(false); return }
    router.push('/expert/apply/connect')
  }

  return (
    <div className="min-h-screen p-6 max-w-xl mx-auto">
      {step === 'intro' && (
        <div className="animate-fade-up space-y-6">
          <div>
            <div className="text-4xl mb-4">🛠️</div>
            <h1 className="font-display text-3xl font-bold text-white mb-3">Become an expert</h1>
            <p className="text-ink-400 leading-relaxed">
              Help people fix things remotely via live video. Set your own rates, work when you want.
              We run a background check on all experts before approval.
            </p>
          </div>
          <div className="card p-5 space-y-3">
            {[
              ['Background check', 'We use Checkr — takes 1–3 days'],
              ['Set your rate', `You choose $25–$300/hr`],
              ['Get paid weekly', 'Via Stripe direct deposit'],
            ].map(([t, s]) => (
              <div key={t} className="flex items-start gap-3">
                <span className="text-brand-500 mt-0.5">✓</span>
                <div>
                  <p className="text-sm font-medium text-white">{t}</p>
                  <p className="text-xs text-ink-500">{s}</p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setStep('details')} className="btn-primary w-full py-3">
            Start application
          </button>
        </div>
      )}

      {step === 'details' && (
        <div className="animate-fade-up space-y-5">
          <h1 className="font-display text-2xl font-bold text-white">About you</h1>
          <div>
            <label className="label">Professional bio</label>
            <textarea className="input min-h-[100px] resize-none"
              placeholder="Describe your experience, specialties, and what makes you a great expert…"
              value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} />
          </div>
          <div>
            <label className="label">Years of experience</label>
            <input type="number" className="input" placeholder="5" min="0" max="50"
              value={form.years} onChange={e => setForm(f => ({ ...f, years: e.target.value }))} />
          </div>
          <div>
            <label className="label">Certifications (optional, comma-separated)</label>
            <input className="input" placeholder="Licensed Plumber, EPA 608, Master Electrician…"
              value={form.certifications} onChange={e => setForm(f => ({ ...f, certifications: e.target.value }))} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep('intro')} className="btn-ghost">← Back</button>
            <button onClick={() => setStep('categories')} disabled={!form.bio || !form.years}
              className="btn-primary flex-1">Continue</button>
          </div>
        </div>
      )}

      {step === 'categories' && (
        <div className="animate-fade-up space-y-5">
          <h1 className="font-display text-2xl font-bold text-white">Your specialties</h1>
          <p className="text-ink-400 text-sm">Select all categories you can help with</p>
          <div className="space-y-2">
            {cats.map(cat => (
              <button key={cat.id} onClick={() => toggleCat(cat.id)}
                className={`w-full card p-4 text-left transition-all
                  ${form.categoryIds.includes(cat.id) ? 'border-brand-500/60 bg-brand-500/5' : 'hover:border-ink-700'}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-white">{cat.name}</p>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-ink-500">${cat.rate_min}–${cat.rate_max}/hr</p>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all
                      ${form.categoryIds.includes(cat.id) ? 'bg-brand-500 border-brand-500' : 'border-ink-600'}`}>
                      {form.categoryIds.includes(cat.id) && <span className="text-white text-[10px]">✓</span>}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep('details')} className="btn-ghost">← Back</button>
            <button onClick={() => setStep('rate')} disabled={form.categoryIds.length === 0}
              className="btn-primary flex-1">Continue</button>
          </div>
        </div>
      )}

      {step === 'rate' && (
        <div className="animate-fade-up space-y-5">
          <h1 className="font-display text-2xl font-bold text-white">Set your rate</h1>
          <p className="text-ink-400 text-sm">This is your hourly rate. Customers pay a small platform fee on top — you keep the full amount.</p>
          <div className="card p-6 text-center">
            <p className="font-display text-5xl font-bold text-brand-400 mb-1">${form.hourlyRate}</p>
            <p className="text-ink-500 text-sm">per hour</p>
            <input type="range" min={25} max={300} step={5} value={form.hourlyRate}
              onChange={e => setForm(f => ({ ...f, hourlyRate: parseInt(e.target.value) }))}
              className="w-full mt-6" />
            <div className="flex justify-between text-xs text-ink-600 mt-1">
              <span>$25</span><span>$300</span>
            </div>
          </div>
          <div className="surface p-4 rounded-xl text-sm text-ink-400">
            <p className="text-white text-sm font-medium mb-1">What you earn per session</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span>30 min session</span><span className="text-green-400">${(form.hourlyRate * 0.5).toFixed(2)}</span></div>
              <div className="flex justify-between"><span>60 min session</span><span className="text-green-400">${form.hourlyRate.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>90 min session</span><span className="text-green-400">${(form.hourlyRate * 1.5).toFixed(2)}</span></div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep('categories')} className="btn-ghost">← Back</button>
            <button onClick={() => setStep('submit')} className="btn-primary flex-1">Review application</button>
          </div>
        </div>
      )}

      {step === 'submit' && (
        <div className="animate-fade-up space-y-5">
          <h1 className="font-display text-2xl font-bold text-white">Review &amp; submit</h1>
          <div className="card p-5 space-y-3 text-sm">
            <Row label="Rate"           value={`$${form.hourlyRate}/hr`} />
            <Row label="Experience"     value={`${form.years} years`} />
            <Row label="Categories"     value={cats.filter(c => form.categoryIds.includes(c.id)).map(c => c.name).join(', ')} />
            {form.certifications && <Row label="Certifications" value={form.certifications} />}
          </div>
          <div className="surface p-4 rounded-xl text-xs text-ink-400 leading-relaxed">
            By submitting, you agree to our Expert Terms and consent to a background check via Checkr. 
            Results typically take 1–3 business days. You'll receive an email when your application is reviewed.
          </div>
          {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => setStep('rate')} className="btn-ghost">← Back</button>
            <button onClick={handleSubmit} disabled={loading} className="btn-primary flex-1 py-3">
              {loading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Submit application'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-ink-500 shrink-0">{label}</span>
      <span className="text-ink-200 text-right">{value}</span>
    </div>
  )
}
