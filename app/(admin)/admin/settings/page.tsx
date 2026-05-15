'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Health { ok: boolean; results: any }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden mb-5">
      <div className="px-5 py-4 border-b border-ink-800 bg-ink-900/40">
        <h2 className="font-display text-sm font-bold text-white">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Row({ label, value, status, href }: { label: string; value: string; status?: 'ok'|'warn'|'error'; href?: string }) {
  const color = status === 'ok' ? 'text-green-400' : status === 'error' ? 'text-red-400' : status === 'warn' ? 'text-yellow-400' : 'text-ink-300'
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-ink-800/60 last:border-0">
      <span className="text-sm text-ink-400">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer"
          className={`text-xs font-mono ${color} hover:underline`}>{value}</a>
      ) : (
        <span className={`text-xs font-mono ${color}`}>{value}</span>
      )}
    </div>
  )
}

export default function AdminSettings() {
  const [health, setHealth]     = useState<Health | null>(null)
  const [loading, setLoading]   = useState(true)
  const [testEmail, setTestEmail]   = useState('')
  const [testType, setTestType]     = useState('plain')
  const [testResult, setTestResult] = useState<any>(null)
  const [testing, setTesting]       = useState(false)

  useEffect(() => {
    fetch('/api/admin/api-health')
      .then(r => r.json())
      .then(d => { setHealth(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const sendTest = async () => {
    if (!testEmail) return
    setTesting(true); setTestResult(null)
    const res  = await fetch('/api/admin/test-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: testType, to: testEmail }),
    })
    setTestResult(await res.json())
    setTesting(false)
  }

  const h = health?.results

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-white">Settings</h1>
        <button onClick={() => { setLoading(true); fetch('/api/admin/api-health').then(r => r.json()).then(d => { setHealth(d); setLoading(false) }) }}
          className="btn-ghost text-sm">↻ Refresh</button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-ink-800 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Overall status */}
          <div className={`card p-4 mb-5 flex items-center gap-3 ${health?.ok ? 'border-green-500/20' : 'border-red-500/20'}`}>
            <span className={`text-2xl ${health?.ok ? 'text-green-400' : 'text-red-400'}`}>
              {health?.ok ? '✓' : '✗'}
            </span>
            <div>
              <p className="font-medium text-white text-sm">
                {health?.ok ? 'All integrations connected' : 'Some integrations need attention'}
              </p>
              <p className="text-xs text-ink-500">Last checked {new Date().toLocaleTimeString()}</p>
            </div>
          </div>

          {/* Stripe */}
          <Section title="💳 Stripe — Payments">
            <Row label="Status"           value={h?.stripe?.ok ? 'Connected' : h?.stripe?.error ?? 'Error'} status={h?.stripe?.ok ? 'ok' : 'error'} />
            <Row label="Mode"             value={h?.stripe?.mode ?? 'unknown'} status={h?.stripe?.mode === 'live' ? 'ok' : 'warn'} />
            <Row label="Secret key"       value={h?.stripe?.keySet ? '✓ Set' : '✗ Missing'} status={h?.stripe?.keySet ? 'ok' : 'error'} />
            <Row label="Webhook secret"   value={h?.stripe?.webhookSet ? '✓ Set' : '✗ Missing'} status={h?.stripe?.webhookSet ? 'ok' : 'error'} />
            <Row label="Publishable key"  value={h?.stripe?.pubKeySet ? '✓ Set' : '✗ Missing'} status={h?.stripe?.pubKeySet ? 'ok' : 'error'} />
            {h?.stripe?.accountId && (
              <Row label="Account" value={h.stripe.accountId}
                href={`https://dashboard.stripe.com/dashboard`} />
            )}
            {h?.stripe?.mode !== 'live' && (
              <p className="text-xs text-yellow-400 mt-3 bg-yellow-500/10 rounded-lg px-3 py-2">
                ⚠️ Using test keys — switch to live keys before going to production
              </p>
            )}
          </Section>

          {/* Resend / Email */}
          <Section title="📧 Resend — Email">
            <Row label="Status"       value={h?.resend?.ok ? 'Connected' : h?.resend?.error ?? 'Error'} status={h?.resend?.ok ? 'ok' : 'error'} />
            <Row label="API key"      value={h?.resend?.keySet ? '✓ Set' : '✗ Missing'} status={h?.resend?.keySet ? 'ok' : 'error'} />
            <Row label="From email"   value={h?.resend?.fromEmail ?? 'NOT SET'} status={h?.resend?.fromEmail && h.resend.fromEmail !== 'NOT SET' ? 'ok' : 'error'} />
            <Row label="Admin alerts" value={h?.resend?.adminEmail ?? 'NOT SET'} status={h?.resend?.adminEmail && h.resend.adminEmail !== 'NOT SET' ? 'ok' : 'warn'} />
            {h?.resend?.domains?.length > 0 && h.resend.domains.map((d: any) => (
              <Row key={d.name} label={`Domain: ${d.name}`} value={d.status}
                status={d.status === 'verified' ? 'ok' : 'warn'}
                href="https://resend.com/domains" />
            ))}

            {/* Email tester */}
            <div className="mt-4 pt-4 border-t border-ink-800 space-y-3">
              <p className="text-xs font-bold text-white">Test email sending</p>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <input value={testEmail} onChange={e => setTestEmail(e.target.value)}
                    className="input text-sm" type="email" placeholder="Send test to…" />
                </div>
                <select value={testType} onChange={e => setTestType(e.target.value)} className="input text-sm">
                  <option value="plain">Plain test</option>
                  <option value="verification">Email verification</option>
                  <option value="booking_confirm">Booking confirmation</option>
                  <option value="session_summary">Session summary</option>
                  <option value="payout">Payout released</option>
                </select>
              </div>
              <button onClick={sendTest} disabled={testing || !testEmail} className="btn-primary text-sm w-full sm:w-auto px-6">
                {testing ? 'Sending…' : 'Send test email'}
              </button>
              {testResult && (
                <div className={`rounded-xl p-3 text-xs border ${testResult.ok ? 'bg-green-500/10 border-green-500/20 text-green-300' : 'bg-red-500/10 border-red-500/20 text-red-300'}`}>
                  {testResult.ok
                    ? `✓ Sent successfully — ID: ${testResult.emailId}`
                    : `✗ Failed: ${testResult.error} ${testResult.code ? `(${testResult.code})` : ''}`}
                  <div className="text-ink-500 mt-1">From: {testResult.debug?.fromEmail} → To: {testResult.debug?.toEmail}</div>
                </div>
              )}
              <div className="bg-ink-900 rounded-xl p-3 text-xs text-ink-500 space-y-1">
                <p className="font-medium text-ink-400">Common issues:</p>
                <p>• Domain not verified in Resend → go to resend.com/domains</p>
                <p>• RESEND_FROM_EMAIL must use your verified domain</p>
                <p>• Free Resend accounts can only send to your own email</p>
              </div>
            </div>
          </Section>

          {/* Video / Daily.co */}
          <Section title="🎥 Daily.co — Video">
            <Row label="Status"   value={h?.daily?.ok ? 'Connected' : h?.daily?.error ?? 'Error'} status={h?.daily?.ok ? 'ok' : 'error'} />
            <Row label="API key"  value={h?.daily?.keySet ? '✓ Set' : '✗ Missing'} status={h?.daily?.keySet ? 'ok' : 'error'} />
            {h?.daily?.domain && <Row label="Domain" value={h.daily.domain} href={`https://${h.daily.domain}`} />}
          </Section>

          {/* Database */}
          <Section title="🗄️ Database">
            <Row label="Status"           value={h?.database?.ok ? 'Connected' : h?.database?.error ?? 'Error'} status={h?.database?.ok ? 'ok' : 'error'} />
            <Row label="Users"            value={String(h?.database?.users ?? 0)} />
            <Row label="Sessions"         value={String(h?.database?.sessions ?? 0)} />
            <Row label="Approved experts" value={String(h?.database?.approvedExperts ?? 0)} />
          </Section>

          {/* Env vars */}
          <Section title="🔑 Environment variables">
            <div className="grid sm:grid-cols-2 gap-x-8">
              {h?.env && Object.entries(h.env).map(([k, v]) => {
                const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
                const isSet = v === true || (typeof v === 'string' && v !== 'NOT SET')
                return (
                  <Row key={k} label={label} value={v === true ? '✓ Set' : v === false ? '✗ Not set' : String(v)}
                    status={isSet ? 'ok' : 'error'} />
                )
              })}
            </div>
          </Section>

          {/* Notification preferences */}
          <Section title="🔔 Notification defaults">
            <p className="text-sm text-ink-400 mb-3">
              Per-user notification preferences are managed by each user in their Alerts page.
              As admin you can override any user's settings from their detail page.
            </p>
            <div className="flex gap-3">
              <Link href="/admin/customers" className="btn-ghost text-sm">Customer notifications →</Link>
              <Link href="/admin/pros" className="btn-ghost text-sm">Expert notifications →</Link>
            </div>
          </Section>

          {/* Quick links */}
          <Section title="🔗 External dashboards">
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { label: 'Stripe Dashboard',    href: 'https://dashboard.stripe.com', icon: '💳' },
                { label: 'Resend Dashboard',    href: 'https://resend.com',           icon: '📧' },
                { label: 'Daily.co Dashboard',  href: 'https://dashboard.daily.co',  icon: '🎥' },
                { label: 'Railway Dashboard',   href: 'https://railway.app',         icon: '🚂' },
                { label: 'GitHub Repo',         href: 'https://github.com/okrangerb3/tightspothelper', icon: '💻' },
                { label: 'Cloudflare R2',       href: 'https://dash.cloudflare.com', icon: '☁️' },
              ].map(link => (
                <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer"
                  className="card p-3 flex items-center gap-3 hover:border-ink-600 transition-colors">
                  <span className="text-lg">{link.icon}</span>
                  <span className="text-sm text-ink-300">{link.label}</span>
                  <span className="ml-auto text-ink-600 text-xs">↗</span>
                </a>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  )
}
