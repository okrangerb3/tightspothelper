'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Message { id: string; user_id: string; text: string; created_at: string }

export default function ChatPanel({ sessionId, userId }: { sessionId: string; userId: string }) {
  const supabase  = createClient()
  const [msgs, setMsgs]   = useState<Message[]>([])
  const [text, setText]   = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Load history from session_messages (simple jsonb column on sessions, or a separate table)
    // Using Supabase Realtime broadcast channel for in-session messaging
    const channel = supabase
      .channel(`chat-${sessionId}`)
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        setMsgs(prev => [...prev, payload as Message])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  const send = async () => {
    if (!text.trim() || sending) return
    setSending(true)

    const msg: Message = {
      id: crypto.randomUUID(),
      user_id: userId,
      text: text.trim(),
      created_at: new Date().toISOString(),
    }

    await supabase.channel(`chat-${sessionId}`).send({
      type: 'broadcast', event: 'message', payload: msg,
    })

    setMsgs(prev => [...prev, msg])
    setText('')
    setSending(false)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {msgs.length === 0 && (
          <p className="text-xs text-ink-600 text-center pt-4">Chat starts here</p>
        )}
        {msgs.map(m => {
          const mine = m.user_id === userId
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] text-sm px-3 py-2 rounded-2xl leading-relaxed
                ${mine
                  ? 'bg-brand-500 text-white rounded-br-sm'
                  : 'bg-ink-800 text-ink-100 rounded-bl-sm'
                }`}>
                {m.text}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-ink-800 p-3 flex gap-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="Message…"
          className="flex-1 bg-ink-900 border border-ink-700 rounded-xl px-3 py-2 text-sm text-ink-100 placeholder:text-ink-600 focus:outline-none focus:border-brand-500"
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          className="btn-primary px-3 py-2 text-sm disabled:opacity-40"
        >
          ↑
        </button>
      </div>
    </div>
  )
}
