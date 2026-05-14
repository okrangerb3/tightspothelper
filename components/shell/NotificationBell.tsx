'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { io, Socket } from 'socket.io-client'
import { useSession } from '@/lib/auth-client'

interface Notification {
  id:        string
  type:      string
  payload:   Record<string, unknown>
  createdAt: string
  readAt:    string | null
}

const TYPE_LABELS: Record<string, (p: any) => string> = {
  recording_ready:   () => 'Recording ready — expires in 30 days',
  recording_upsell:  () => 'Recording expiring soon — keep it?',
  session_confirmed: (p: any) => `Session confirmed with ${p?.expert_name ?? 'your expert'}`,
}

const TYPE_LINKS: Record<string, (p: any) => string | undefined> = {
  recording_ready:  (p: any) => `/customer/sessions/${p?.session_id}/recording`,
  recording_upsell: (p: any) => `/customer/sessions/${p?.session_id}/recording?action=keep`,
}

export default function NotificationBell({ role }: { role: string }) {
  const { data: sessionData } = useSession()
  const [notes, setNotes]     = useState<Notification[]>([])
  const [open, setOpen]       = useState(false)
  const ref    = useRef<HTMLDivElement>(null)
  const socket = useRef<Socket | null>(null)

  const userId = sessionData?.user?.id

  // ── Load notifications on mount ──────────────────────────
  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(({ notifications }) => {
        setNotes((notifications ?? []).map((n: any) => ({
          ...n,
          createdAt: n.createdAt ?? n.created_at,
          readAt:    n.readAt ?? n.read_at ?? null,
        })))
      })
      .catch(() => {})
  }, [])

  // ── Socket.IO — subscribe to notification:new ─────────────
  useEffect(() => {
    if (!userId) return

    const s = io({ path: '/socket.io', withCredentials: true })
    socket.current = s

    s.on('notification:new', (notification: Notification) => {
      setNotes(prev => [notification, ...prev])
    })

    return () => { s.disconnect(); socket.current = null }
  }, [userId])

  // ── Close on outside click ────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unread = notes.filter(n => !n.readAt).length

  const markRead = async (ids: string[]) => {
    if (ids.length === 0) return
    await fetch('/api/notifications/mark-all-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }).catch(() => {})
    setNotes(prev => prev.map(n => ids.includes(n.id) ? { ...n, readAt: new Date().toISOString() } : n))
  }

  const handleOpen = () => {
    const willOpen = !open
    setOpen(willOpen)
    if (willOpen) {
      const unreadIds = notes.filter(n => !n.readAt).map(n => n.id)
      markRead(unreadIds)
    }
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
