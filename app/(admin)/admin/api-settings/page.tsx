'use client'

import { useState, useEffect } from 'react'

interface HealthResult {
  ok: boolean
  error?: string
  [key: string]: any
}

interface Health {
  ok: boolean
  results: {
    stripe:   HealthResult
    resend:   HealthResult
    database: HealthResult
    daily:    HealthResult
    env:      Record<string, any>
  }
}

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
      ${ok ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
      {ok ? '✓ Connected' : '✗ Error'}
    </span>
  )
}

function KeyRow({ label, value }: { label: string; value: any }) {
  const isSet     = value === true || (typeof value === 'string' && value !== 'NOT SET' && value !== '')
  const display   = value === true ? '✓ Set' : value === false ? '✗ Not set' : String(value)
  return (
    <div className="flex items-center justify-between py-2 border-b border-ink-800/50 last:border-0">
      <span className="text-xs text-ink-400">{label}</span>
      <span className={`text-xs font-mono ${isSet ? 'text-green-400' : 'text-red-400'}`}>{display}</span>
    </div>
  )
}

export default function ApiSettingsPage() {
  const [health,  setHealth]  = useState<Health | null>(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)

  // Notification test state
  const [testEmail,  setTestEmail]  = useState('')
  const [testType,   setTestType]   = useState('plain')
  const [testResult, setTestResult] = useState<any>(null)
  const [testLoading, setTestLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const res  = await fetch('/api/admin/api-health')
    const data = await res.json()
    setHealth(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const sendTest = async () => {
    if (!testEmail) return
    setTestLoading(true); setTestResult(null)
    const res  = await fetch('/api/admin/test-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: testType, to: testEmail }),
    })
    const data = await res.json()
    setTestResult(data)
    setTestLoading(false)
  }

  if (loading) return (
    <div className="p-8 space-y-4">
      {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-ink-800 rounded-xl animate-pulse" />)}
    </div>
  )

  const h = health!

  return (
    <div className="p-4 sm:p-8 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-white">API & Integrations</h1>
        <button onClick={load} className="btn-ghost text-sm">↻ Refresh</button>
      </div>

      {/* Overall status */}
      <div className={`card p-4 flex items-center gap-3 ${h.ok ? 'border-green-500/20' : 'border-red-500/20'}`}>
        <span className={`text-2xl ${h.ok ? 'text-green-400' : 'text-red-400'}`}>{h.ok ? '✓' : '✗'}</span>
        <div>
          <p className="font-medium text-white text-sm">{h.ok ? 'All systems operational' : 'Some integrations need attention'}</p>
          <p className="text-xs text-ink-500">Last checked {new Date().toLocaleTimeString()}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Stripe */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-sm font-bold text-white">Stripe</h2>
            <StatusBadge ok={h.results.stripe.ok} />
          </div>
          {h.results.stripe.error && (
            <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2 mb-3">{h.results.stripe.error}</p>
          )}
          <div className="space-y-0">
            <KeyRow label="Mode"           value={h.results.stripe.mode ?? 'unknown'} />
            <KeyRow label="Secret key"     value={h.results.stripe.keySet} />
            <KeyRow label="Webhook secret" value={h.results.stripe.webhookSet} />
            <KeyRow label="Publishable key" value={h.results.stripe.pubKeySet} />
            {h.results.stripe.accountId && (
              <KeyRow label="Account ID" value={h.results.stripe.accountId} />
            )}
          </div>
          {h.results.stripe.mode === 'test' && (
            <p className="text-[10px] text-yellow-400 mt-3">
              ⚠️ Running in test mode — use live keys for production
            </p>
          )}
        </div>

        {/* Resend */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-sm font-bold text-white">Resend (Email)</h2>
            <StatusBadge ok={h.results.resend.ok} />
          </div>
          {h.results.resend.error && (
            <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2 mb-3">{h.results.resend.error}</p>
          )}
          <div className="space-y-0">
            <KeyRow label="API key"     value={h.results.resend.keySet} />
            <KeyRow label="From email"  value={h.results.resend.fromEmail} />
            <KeyRow label="Admin email" value={h.results.resend.adminEmail} />
          </div>
          {h.results.resend.domains?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-ink-800">
              <p className="text-[10px] text-ink-500 mb-2 uppercase tracking-wide">Verified domains</p>
              {h.results.resend.domains.map((d: any) => (
                <div key={d.name} className="flex items-center justify-between text-xs py-1">
                  <span className="text-ink-300 font-mono">{d.name}</span>
                  <span className={d.status === 'verified' ? 'text-green-400' : 'text-yellow-400'}>{d.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Database */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-sm font-bold text-white">Database</h2>
            <StatusBadge ok={h.results.database.ok} />
          </div>
          <div className="space-y-0">
            <KeyRow label="Users"            value={h.results.database.users ?? 0} />
            <KeyRow label="Sessions"         value={h.results.database.sessions ?? 0} />
            <KeyRow label="Approved experts" value={h.results.database.approvedExperts ?? 0} />
          </div>
        </div>

        {/* Daily.co */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-sm font-bold text-white">Daily.co (Video)</h2>
            <StatusBadge ok={h.results.daily.ok} />
          </div>
          {h.results.daily.error && (
            <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2 mb-3">{h.results.daily.error}</p>
          )}
          <div className="space-y-0">
            <KeyRow label="API key" value={h.results.daily.keySet} />
            {h.results.daily.domain && <KeyRow label="Domain" value={h.results.daily.domain} />}
          </div>
        </div>
      </div>

      {/* Env vars */}
      <div className="card p-5">
        <h2 className="font-display text-sm font-bold text-white mb-4">Environment variables</h2>
        <div className="grid sm:grid-cols-2 gap-x-8">
          {Object.entries(h.results.env).map(([k, v]) => (
            <KeyRow key={k} label={k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())} value={v} />
          ))}
        </div>
      </div>

      {/* Notification tester */}
      <div className="card p-5">
        <h2 className="font-display text-sm font-bold text-white mb-1">Test notifications</h2>
        <p className="text-xs text-ink-500 mb-4">Send a test email to diagnose Resend issues</p>

        <div className="grid sm:grid-cols-3 gap-3 mb-3">
          <div className="sm:col-span-2">
            <label className="label">Send test to</label>
            <input value={testEmail} onChange={e => setTestEmail(e.target.value)}
              className="input" type="email" placeholder="your@email.com" />
          </div>
          <div>
            <label className="label">Template</label>
            <select value={testType} onChange={e => setTestType(e.target.value)} className="input">
              <option value="plain">Plain test</option>
              <option value="verification">Email verification</option>
              <option value="booking_confirm">Booking confirmation</option>
              <option value="session_summary">Session summary</option>
              <option value="payout">Payout released</option>
            </select>
          </div>
        </div>

        <button onClick={sendTest} disabled={testLoading || !testEmail} className="btn-primary text-sm">
          {testLoading ? 'Sending…' : 'Send test email'}
        </button>

        {testResult && (
          <div className={`mt-4 p-4 rounded-xl text-sm border
            ${testResult.ok ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
            <p className={`font-medium mb-2 ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}>
              {testResult.ok ? '✓ Email sent successfully' : '✗ Failed to send email'}
            </p>
            {testResult.emailId && <p className="text-xs text-ink-400">Email ID: {testResult.emailId}</p>}
            {testResult.error   && <p className="text-xs text-red-300">Error: {testResult.error}</p>}
            {testResult.code    && <p className="text-xs text-red-300">Code: {testResult.code}</p>}
            <div className="mt-2 pt-2 border-t border-white/10 text-xs text-ink-500 space-y-0.5">
              <p>API key set: {testResult.debug?.apiKeySet ? '✓' : '✗ NOT SET'}</p>
              <p>From: {testResult.debug?.fromEmail}</p>
              <p>To: {testResult.debug?.toEmail}</p>
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-ink-800">
          <p className="text-[10px] text-ink-500 font-bold uppercase tracking-wide mb-2">Common Resend issues</p>
          <ul className="text-xs text-ink-500 space-y-1">
            <li>• <strong className="text-ink-300">Domain not verified</strong> — go to resend.com/domains and verify your sending domain</li>
            <li>• <strong className="text-ink-300">Wrong FROM address</strong> — RESEND_FROM_EMAIL must use your verified domain</li>
            <li>• <strong className="text-ink-300">API key missing</strong> — add RESEND_API_KEY to Railway environment variables</li>
            <li>• <strong className="text-ink-300">Sandbox mode</strong> — free Resend accounts can only send to your own email</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
