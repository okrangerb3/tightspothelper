'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'

type Step = 'account' | 'verify' | 'billing' | 'done'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep]     = useState<Step>('account')
  const [role, setRole]     = useState<'customer' | 'expert'>('customer')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '',
    phone: '', city: '', state: '', zip: '',
  })

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSignup = async () => {
    setLoading(true); setError(null)
    if (!form.firstName || !form.email || !form.password) {
      setError('Please fill in all required fields'); setLoading(false); return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters'); setLoading(false); return
    }

    const name = [form.firstName, form.lastName].filter(Boolean).join(' ')
    const res  = await authClient.signUp.email({
      email:    form.email,
      password: form.password,
      name,
      callbackURL: '/customer/dashboard',
    })

    if (res.error) { setError(res.error.message ?? 'Signup failed'); setLoading(false); return }

    // Save extended profile fields
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: form.firstName, lastName: form.lastName,
        phone: form.phone, city: form.city, state: form.state, zip: form.zip,
      }),
    })

    setStep('verify')
      // Track invite conversion
      if (inviteCode) {
        fetch('/api/invite/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inviteCode }),
        }).catch(() => {})
      }
    setLoading(false)
  }

  const handleResendVerification = async () => {
    setLoading(true)
    await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email }),
    })
    setLoading(false)
  }

  const handleSkipToBilling = () => setStep('billing')

  const handleSetupBilling = async () => {
    router.push('/customer/payment-methods?onboarding=1')
  }

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="font-display font-bold text-white text-xl">
            TightSpot<span className="text-brand-500">Helper</span>
          </Link>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-8">
          {(['account', 'verify', 'billing'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                ${step === s || (step === 'done' && i < 3)
                  ? 'bg-brand-500 text-white'
                  : ['account','verify','billing'].indexOf(step) > i
                    ? 'bg-green-500 text-white'
                    : 'bg-ink-800 text-ink-500'}`}>
                {['account','verify','billing'].indexOf(step) > i ? '✓' : i + 1}
              </div>
              <span className={`text-xs ${step === s ? 'text-white' : 'text-ink-600'} hidden sm:block`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
              {i < 2 && <div className="flex-1 h-px bg-ink-800" />}
            </div>
          ))}
        </div>

        {/* Step 1: Account */}
        {step === 'account' && (
          <div className="card p-6 space-y-4">
            <h1 className="font-display text-xl font-bold text-white">Create your account</h1>

            {/* Role picker */}
            <div className="grid grid-cols-2 gap-2">
              {(['customer', 'expert'] as const).map(r => (
                <button key={r} onClick={() => setRole(r)}
                  className={`py-2.5 rounded-lg border text-sm font-medium transition-colors
                    ${role === r
                      ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                      : 'border-ink-700 text-ink-400 hover:border-ink-600'}`}>
                  {r === 'customer' ? '🏠 Get help' : '🛠️ Be an expert'}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-ink-400 mb-1.5">First name *</label>
                <input value={form.firstName} onChange={set('firstName')}
                  className="input w-full" placeholder="Jane" autoFocus />
              </div>
              <div>
                <label className="block text-xs text-ink-400 mb-1.5">Last name</label>
                <input value={form.lastName} onChange={set('lastName')}
                  className="input w-full" placeholder="Smith" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-ink-400 mb-1.5">Email address (your username) *</label>
              <input value={form.email} onChange={set('email')} type="email"
                className="input w-full" placeholder="jane@example.com" />
            </div>

            <div>
              <label className="block text-xs text-ink-400 mb-1.5">Password *</label>
              <input value={form.password} onChange={set('password')} type="password"
                className="input w-full" placeholder="Min. 8 characters" />
            </div>

            <div>
              <label className="block text-xs text-ink-400 mb-1.5">Phone number</label>
              <input value={form.phone} onChange={set('phone')} type="tel"
                className="input w-full" placeholder="+1 (555) 000-0000" />
            </div>

            <div>
              <label className="block text-xs text-ink-400 mb-1.5">City</label>
              <input value={form.city} onChange={set('city')}
                className="input w-full" placeholder="Houston" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-ink-400 mb-1.5">State</label>
                <select value={form.state} onChange={set('state')} className="input w-full">
                  <option value="">State</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-ink-400 mb-1.5">ZIP code</label>
                <input value={form.zip} onChange={set('zip')}
                  className="input w-full" placeholder="77001" maxLength={10} />
              </div>
            </div>

            {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

            <button onClick={handleSignup} disabled={loading} className="btn-primary w-full">
              {loading ? 'Creating account…' : 'Create account →'}
            </button>

            <p className="text-center text-xs text-ink-500">
              Already have an account?{' '}
              <Link href="/login" className="text-brand-400 hover:text-brand-300">Log in</Link>
            </p>
          </div>
        )}

        {/* Step 2: Email verification */}
        {step === 'verify' && (
          <div className="card p-6 text-center space-y-5">
            <div className="text-4xl">📧</div>
            <h2 className="font-display text-xl font-bold text-white">Check your email</h2>
            <p className="text-sm text-ink-400">
              We sent a verification link to <span className="text-white">{form.email}</span>.
              Click it to verify your account and continue.
            </p>
            <div className="space-y-2">
              <button onClick={handleResendVerification} disabled={loading}
                className="btn-ghost w-full text-sm">
                {loading ? 'Sending…' : 'Resend verification email'}
              </button>
              <button onClick={handleSkipToBilling}
                className="w-full text-xs text-ink-600 hover:text-ink-400 transition-colors py-2">
                Skip for now — set up billing
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Billing */}
        {step === 'billing' && (
          <div className="card p-6 space-y-5">
            <div className="text-3xl">💳</div>
            <h2 className="font-display text-xl font-bold text-white">Set up billing</h2>
            <p className="text-sm text-ink-400">
              Add a payment method so you're ready to book sessions instantly.
              We accept credit cards, Apple Pay, and Google Pay.
            </p>
            <div className="flex gap-3 text-2xl justify-center py-2">
              <span title="Visa">💳</span>
              <span title="Apple Pay">🍎</span>
              <span title="Google Pay">G</span>
            </div>
            <p className="text-xs text-ink-600 text-center">
              Secured by Stripe — your card details are never stored on our servers
            </p>
            <button onClick={handleSetupBilling} className="btn-primary w-full">
              Add payment method →
            </button>
            <button onClick={() => router.push('/customer/dashboard')}
              className="w-full text-xs text-ink-600 hover:text-ink-400 transition-colors py-2">
              Skip — I'll add billing later
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
