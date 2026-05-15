'use client'

import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

// ── Inner form component (must be inside <Elements>) ────────────
function CardForm({
  onSuccess,
  onCancel,
  label = 'Save card',
}: {
  onSuccess: () => void
  onCancel?: () => void
  label?: string
}) {
  const stripe   = useStripe()
  const elements = useElements()

  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setLoading(true); setError(null)

    const { error: submitErr } = await elements.submit()
    if (submitErr) { setError(submitErr.message ?? 'Validation failed'); setLoading(false); return }

    // Confirm the SetupIntent with the card details
    const returnUrl = `${window.location.origin}/customer/payment-methods?setup=complete`
    const { error: confirmErr } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: 'if_required',
    })

    if (confirmErr) {
      setError(confirmErr.message ?? 'Card setup failed')
      setLoading(false)
      return
    }

    // Success — no redirect needed (card saved)
    setLoading(false)
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: 'tabs',
          fields: { billingDetails: { name: 'auto', email: 'never' } },
        }}
      />

      {error && (
        <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost flex-1">
            Cancel
          </button>
        )}
        <button type="submit" disabled={loading || !stripe} className="btn-primary flex-1">
          {loading
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : label}
        </button>
      </div>
    </form>
  )
}

// ── Exported wrapper — handles SetupIntent creation ─────────────
export default function PaymentMethodSetup({
  onSuccess,
  onCancel,
  label,
}: {
  onSuccess: () => void
  onCancel?: () => void
  label?: string
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [fetchError, setFetchError]     = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/payments/setup-intent', { method: 'POST' })
      .then(r => r.json())
      .then(d => {
        if (d.error) setFetchError(d.error)
        else setClientSecret(d.clientSecret)
      })
      .catch(() => setFetchError('Failed to initialise payment. Try again.'))
  }, [])

  if (fetchError) return (
    <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
      {fetchError}
    </p>
  )

  if (!clientSecret) return (
    <div className="flex items-center justify-center py-8">
      <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme:     'night',
          variables: {
            colorPrimary:    '#f97c0a',
            colorBackground: '#18171a',
            colorText:       '#e4e3de',
            colorDanger:     '#f87171',
            fontFamily:      'DM Sans, system-ui, sans-serif',
            borderRadius:    '12px',
          },
        },
      }}
    >
      <CardForm onSuccess={onSuccess} onCancel={onCancel} label={label} />
    </Elements>
  )
}

# cache bust Thu May 14 20:04:47 CDT 2026
