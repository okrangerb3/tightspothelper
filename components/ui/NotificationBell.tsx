'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'

interface Notification {
  id: string
  type: string
  payload: Record<string, any>
  createdAt: string
  readAt: string | null
}

const TYPE_LABELS: Record<string, (p: any) => string> = {
  recording_ready:   () => `Recording ready — expires in 30 days`,
  recording_upsell:  () => `Recording expiring soon — keep it?`,
  session_confirmed: (p: any) => `Session confirmed with ${p?.expert_name ?? 'your expert'}`,
}

const TYPE_LINKS: Record<string, (p: any) => string> = {
  recording_ready:  (p: any) => `/customer/sessions/${p?.session_id}/recording`,
  recording_upsell: (p: any) => `/customer/sessions/${p?.session_id}/recording?action=keep`,
}

export default function NotificationBell({ role }: { role: string }) {
  const [notes, setNotes] = useState<Notification[]>([])
  const [open, setOpen]   = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unread = notes.filter(n => !n.readAt).length

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/notifications')
      const { notifications } = await res.json()
      setNotes((notifications ?? []).map((n: any) => ({ ...n, createdAt: n.createdAt ?? n.created_at, readAt: n.readAt ?? n.read_at })))
    }
    load()

    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const markRead = async (ids: string[]) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    setNotes(prev => prev.map(n => ids.includes(n.id) ? { ...n, readAt: new Date().toISOString() } : n))
  }

  const handleOpen = () => {
    setOpen(o => !o)
    const unreadIds = notes.filter(n => !n.readAt).map(n => n.id)
    if (unreadIds.length > 0) markRead(unreadIds)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative w-8 h-8 flex items-center justify-center text-ink-400 hover:text-ink-200 transition-colors rounded-lg hover:bg-ink-800"
        aria-label="Notifications"
      >
        <i className="ti ti-bell text-base" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-brand-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-72 card shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-ink-800">
            <p className="text-xs font-medium text-ink-300">Notifications</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notes.length === 0 ? (
              <p className="text-xs text-ink-600 text-center py-6">No notifications</p>
            ) : notes.map(n => {
              const label = TYPE_LABELS[n.type]?.(n.payload) ?? n.type
              const href  = TYPE_LINKS[n.type]?.(n.payload)

              const inner = (
                <div className={`px-4 py-3 border-b border-ink-800 last:border-0 transition-colors hover:bg-ink-800 ${!n.readAt ? 'bg-brand-500/5' : ''}`}>
                  <p className="text-xs text-ink-200 leading-relaxed">{label}</p>
                  <p className="text-[10px] text-ink-600 mt-0.5">{new Date(n.createdAt).toLocaleDateString()}</p>
                </div>
              )

              return href ? (
                <Link key={n.id} href={href} onClick={() => setOpen(false)}>{inner}</Link>
              ) : (
                <div key={n.id}>{inner}</div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}


const TYPE_LABELS: Record<string, (p: any) => string> = {
  recording_ready:   p => `Recording ready — expires in 30 days`,
  recording_upsell:  p => `Recording expiring soon — keep it?`,
  session_confirmed: p => `Session confirmed with ${p?.expert_name ?? 'your expert'}`,
}

const TYPE_LINKS: Record<string, (p: any) => string> = {
  recording_ready:  p => `/customer/sessions/${p?.session_id}/recording`,
  recording_upsell: p => `/customer/sessions/${p?.session_id}/recording?action=keep`,
}

export default function NotificationBell({ role }: { role: string }) {
  const [notes, setNotes] = useState<Notification[]>([])
  const [open, setOpen]   = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unread = notes.filter(n => !n.readAt).length

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/notifications')
      const { notifications } = await res.json()
      setNotes(notifications ?? [])
    }
    load()

    // Close on outside click
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const markRead = async (ids: string[]) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    setNotes(prev => prev.map(n => ids.includes(n.id) ? { ...n, readAt: new Date().toISOString() } : n))
  }

  const handleOpen = () => {
    setOpen(o => !o)
    const unreadIds = notes.filter(n => !n.readAt).map(n => n.id)
    if (unreadIds.length > 0) markRead(unreadIds)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative w-8 h-8 flex items-center justify-center text-ink-400 hover:text-ink-200 transition-colors rounded-lg hover:bg-ink-800"
        aria-label="Notifications"
      >
        <i className="ti ti-bell text-base" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-brand-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-72 card shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-ink-800">
            <p className="text-xs font-medium text-ink-300">Notifications</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notes.length === 0 ? (
              <p className="text-xs text-ink-600 text-center py-6">No notifications</p>
            ) : notes.map(n => {
              const label = TYPE_LABELS[n.type]?.(n.payload) ?? n.type
              const href  = TYPE_LINKS[n.type]?.(n.payload)

              const inner = (
                <div className={`px-4 py-3 border-b border-ink-800 last:border-0 transition-colors hover:bg-ink-800 ${!n.readAt ? 'bg-brand-500/5' : ''}`}>
                  <p className="text-xs text-ink-200 leading-relaxed">{label}</p>
                  <p className="text-[10px] text-ink-600 mt-0.5">{new Date(n.created_at).toLocaleDateString()}</p>
                </div>
              )

              return href ? (
                <Link key={n.id} href={href} onClick={() => setOpen(false)}>{inner}</Link>
              ) : (
                <div key={n.id}>{inner}</div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
