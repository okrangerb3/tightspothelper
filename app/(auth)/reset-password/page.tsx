'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { resetPassword } from '@/lib/auth-client'

export default function ResetPasswordPage() {
  const router   = useRouter()
  const params   = useSearchParams()

  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return }

    setLoading(true); setError(null)

    const token = params.get('token') ?? ''
    const { error } = await resetPassword({ newPassword: password, token })
    if (error) { setError(error.message); setLoading(false); return }

    router.push('/login?message=password_reset')
  }

  return (
    <div className="w-full max-w-sm animate-fade-up">
      <div className="text-center mb-8">
        <h1 className="font-display text-3xl font-bold text-white mb-2">New password</h1>
        <p className="text-ink-400 text-sm">Choose a strong password for your account</p>
      </div>

      <div className="card p-6">
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="label">New password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="input" placeholder="Min. 8 characters" required minLength={8}
              autoComplete="new-password" />
          </div>
          <div>
            <label className="label">Confirm password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              className="input" placeholder="Same as above" required minLength={8}
              autoComplete="new-password" />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
