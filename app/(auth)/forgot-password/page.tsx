'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail]   = useState('')
  const [sent, setSent]     = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (error) { setError(error.message); setLoading(false); return }
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="w-full max-w-sm animate-fade-up">
      <div className="text-center mb-8">
        <h1 className="font-display text-3xl font-bold text-white mb-2">Reset password</h1>
        <p className="text-ink-400 text-sm">We'll send a reset link to your email</p>
      </div>

      <div className="card p-6">
        {sent ? (
          <div className="text-center py-2">
            <div className="text-3xl mb-4">📬</div>
            <p className="text-sm font-medium text-white mb-1">Check your email</p>
            <p className="text-xs text-ink-400">
              We sent a password reset link to <strong>{email}</strong>.
              Check your spam folder if it doesn't arrive within a minute.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email address</label>
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

            {error && (
              <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Send reset link'}
            </button>
          </form>
        )}
      </div>

      <p className="text-center text-ink-500 text-sm mt-5">
        <Link href="/login" className="text-brand-400 hover:text-brand-300 transition-colors">
          ← Back to sign in
        </Link>
      </p>
    </div>
  )
}
