'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import PaymentMethodSetup from '@/components/payments/PaymentMethodSetup'

interface PaymentMethod {
  id: string; brand: string; last4: string
  expMonth: number; expYear: number; isDefault: boolean
}

const BRAND_ICONS: Record<string, string> = {
  visa:       '💳',
  mastercard: '💳',
  amex:       '💳',
  discover:   '💳',
}

export default function PaymentMethodsPage() {
  const params = useSearchParams()

  const [methods, setMethods]     = useState<PaymentMethod[]>([])
  const [loading, setLoading]     = useState(true)
  const [adding, setAdding]       = useState(false)
  const [defaultId, setDefaultId] = useState<string | null>(null)
  const [acting, setActing]       = useState<string | null>(null)
  const [success, setSuccess]     = useState(params.get('setup') === 'complete')

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/payments/methods')
    const { methods: m, defaultId: d } = await res.json()
    setMethods(m ?? [])
    setDefaultId(d)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const remove = async (id: string) => {
    setActing(id)
    await fetch(`/api/payments/methods/${id}`, { method: 'DELETE' })
    await load()
    setActing(null)
  }

  const setDefault = async (id: string) => {
    setActing(id)
    await fetch(`/api/payments/methods/${id}`, { method: 'PATCH' })
    setDefaultId(id)
    setMethods(m => m.map(pm => ({ ...pm, isDefault: pm.id === id })))
    setActing(null)
  }

  return (
    <div className="p-8 max-w-xl">
      <h1 className="font-display text-2xl font-bold text-white mb-6">Payment methods</h1>

      {success && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-5 flex items-center gap-2">
          <span className="text-green-400">✓</span>
          <p className="text-sm text-green-300">Card saved successfully</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Saved cards */}
          {methods.length > 0 && (
            <div className="card divide-y divide-ink-800 mb-4">
              {methods.map(m => (
                <div key={m.id} className="flex items-center justify-between p-4 gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{BRAND_ICONS[m.brand] ?? '💳'}</span>
                    <div>
                      <p className="text-sm font-medium text-ink-100 capitalize">
                        {m.brand} ···· {m.last4}
                        {m.isDefault && (
                          <span className="ml-2 text-[10px] bg-brand-500/20 text-brand-400 px-2 py-0.5 rounded-full">default</span>
                        )}
                      </p>
                      <p className="text-xs text-ink-500">Expires {m.expMonth}/{m.expYear}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!m.isDefault && (
                      <button
                        onClick={() => setDefault(m.id)}
                        disabled={acting === m.id}
                        className="text-xs text-ink-400 hover:text-ink-200 transition-colors px-2 py-1 rounded border border-ink-700 hover:border-ink-500"
                      >
                        {acting === m.id ? '…' : 'Set default'}
                      </button>
                    )}
                    <button
                      onClick={() => remove(m.id)}
                      disabled={acting === m.id}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded border border-red-500/20 hover:border-red-500/40"
                    >
                      {acting === m.id ? '…' : 'Remove'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {methods.length === 0 && !adding && (
            <div className="card p-8 text-center mb-4">
              <p className="text-ink-500 text-sm mb-1">No payment methods saved</p>
              <p className="text-ink-600 text-xs">Add a card to book sessions and purchase recordings</p>
            </div>
          )}

          {/* Add new card */}
          {adding ? (
            <div className="card p-5">
              <p className="text-sm font-medium text-white mb-4">Add a new card</p>
              <PaymentMethodSetup
                onSuccess={() => { setAdding(false); setSuccess(true); load() }}
                onCancel={() => setAdding(false)}
                label="Save card"
              />
            </div>
          ) : (
            <button onClick={() => { setAdding(true); setSuccess(false) }} className="btn-ghost w-full">
              + Add payment method
            </button>
          )}

          <p className="text-xs text-ink-600 text-center mt-4">
            Payments are processed securely by Stripe. Your card details are never stored on our servers.
          </p>
        </>
      )}
    </div>
  )
}
