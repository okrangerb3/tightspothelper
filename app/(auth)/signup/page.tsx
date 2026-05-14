'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signUp, signIn } from '@/lib/auth-client'

type Role = 'customer' | 'expert'

const ROLES = [
  {
    id:       'customer' as Role,
    emoji:    '🔧',
    headline: 'I need help',
    sub:      'Connect with a vetted expert over live video to diagnose and fix your problem.',
    perks:    ['Book in minutes', 'Share photos & video', 'Pay only after the session'],
  },
  {
    id:       'expert' as Role,
    emoji:    '🛠️',
    headline: 'I can help',
    sub:      'Apply to become an expert. Set your own rate, work on your schedule.',
    perks:    ['Set your own rates', 'Get paid via direct deposit', 'Build your reputation'],
  },
]

export default function SignupPage() {
  const router    = useRouter()
  const params    = useSearchParams()

  // Pre-select role from URL if coming from landing page CTA
  const defaultRole = (params.get('role') as Role | null) ?? null
  const [role, setRole]         = useState<Role | null>(defaultRole)
  const [step, setStep]         = useState<'role' | 'details'>(defaultRole ? 'details' : 'role')
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const handleRoleSelect = (r: Role) => {
    setRole(r)
    setStep('details')
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!role) return
    setLoading(true)
    setError(null)

    const { error: authError } = await signUp.email({
      email,
      password,
      name,
      // additional fields for better-auth
      fetchOptions: { body: JSON.stringify({ role }) },
    } as any)

    if (authError) { setError(authError.message ?? null); setLoading(false); return }

    // After signup, update the role (better-auth sets default 'customer')
    // We pass role as an additional field — if better-auth doesn't pick it up from
    // the initial signup, update it immediately via our API
    await fetch('/api/auth/update-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })

    router.push(role === 'expert' ? '/expert/apply' : '/customer/dashboard')
    router.refresh()
  }

  const handleOAuth = async (provider: 'google' | 'apple') => {
    if (!role) return
    await signIn.social({
      provider,
      callbackURL: role === 'expert' ? '/expert/apply' : '/customer/dashboard',
    })
  }

  return (
    <div className="w-full animate-fade-up">
      {step === 'role' ? (
        /* ── Step 1: Role picker ─────────────────────── */
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="font-display text-4xl font-bold text-white mb-3">
              How can we help?
            </h1>
            <p className="text-ink-400">Choose your role to get started</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {ROLES.map(r => (
              <button
                key={r.id}
                onClick={() => handleRoleSelect(r.id)}
                className="card p-6 text-left hover:border-brand-500/50 hover:bg-ink-800 transition-all duration-200 group"
              >
                <div className="text-4xl mb-4">{r.emoji}</div>
                <h2 className="font-display text-xl font-bold text-white mb-2 group-hover:text-brand-400 transition-colors">
                  {r.headline}
                </h2>
                <p className="text-ink-400 text-sm mb-5 leading-relaxed">{r.sub}</p>
                <ul className="space-y-2">
                  {r.perks.map(perk => (
                    <li key={perk} className="flex items-center gap-2 text-xs text-ink-300">
                      <span className="w-4 h-4 rounded-full bg-brand-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-brand-400 text-[10px]">✓</span>
                      </span>
                      {perk}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 text-xs font-medium text-brand-400 group-hover:text-brand-300 transition-colors flex items-center gap-1">
                  Get started <span>→</span>
                </div>
              </button>
            ))}
          </div>

          <p className="text-center text-ink-500 text-sm mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-400 hover:text-brand-300 transition-colors">Sign in</Link>
          </p>
        </div>
      ) : (
        /* ── Step 2: Account details ─────────────────── */
        <div className="max-w-sm mx-auto">
          <button
            onClick={() => setStep('role')}
            className="flex items-center gap-1.5 text-ink-400 hover:text-ink-200 text-sm mb-6 transition-colors"
          >
            ← Back
          </button>

          <div className="text-center mb-8">
            <div className="text-3xl mb-3">{ROLES.find(r => r.id === role)?.emoji}</div>
            <h1 className="font-display text-2xl font-bold text-white mb-1">
              {role === 'customer' ? 'Create your account' : 'Apply as an expert'}
            </h1>
            <p className="text-ink-400 text-sm">
              {role === 'customer'
                ? 'Get help in minutes'
                : 'We\'ll review your application after signup'}
            </p>
          </div>

          <div className="card p-6">
            {/* SSO */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button onClick={() => handleOAuth('google')} className="btn-ghost py-2.5 text-sm">
                <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </button>
              <button onClick={() => handleOAuth('apple')} className="btn-ghost py-2.5 text-sm">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                Apple
              </button>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-ink-700" />
              <span className="text-xs text-ink-500">or with email</span>
              <div className="flex-1 h-px bg-ink-700" />
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="label">Full name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="input"
                  placeholder="Jane Smith"
                  required
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input"
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : role === 'expert' ? 'Start my application' : 'Create account'
                }
              </button>

              <p className="text-xs text-ink-500 text-center leading-relaxed">
                By signing up you agree to our{' '}
                <Link href="/terms" className="text-ink-300 hover:text-white transition-colors">Terms</Link>
                {' '}and{' '}
                <Link href="/privacy" className="text-ink-300 hover:text-white transition-colors">Privacy Policy</Link>
              </p>
            </form>
          </div>

          <p className="text-center text-ink-500 text-sm mt-5">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-400 hover:text-brand-300 transition-colors">Sign in</Link>
          </p>
        </div>
      )}
    </div>
  )
}
