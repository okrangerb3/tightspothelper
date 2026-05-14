'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import VideoCall from '@/components/session/VideoCall'
import PhotoPanel from '@/components/session/PhotoPanel'
import ChatPanel  from '@/components/session/ChatPanel'

type Tab = 'photos' | 'chat' | 'notes'

export default function SessionRoom({ session, userId, isExpert }: {
  session: any; userId: string; isExpert: boolean
}) {
  const router = useRouter()
  const [tab, setTab]     = useState<Tab>('photos')
  const [notes, setNotes] = useState(session.notes ?? '')
  const [parts, setParts] = useState<string[]>(session.parts_needed ?? [])
  const [newPart, setNewPart] = useState('')
  const [ended, setEnded] = useState(false)

  const handleEnd = async (durationSeconds: number) => {
    setEnded(true)
    await fetch(`/api/sessions/${session.id}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationSeconds, notes, parts_needed: parts }),
    })
    router.push(isExpert ? `/expert/sessions/${session.id}/summary` : `/customer/sessions/${session.id}/summary`)
  }

  const saveNotes = async () => {
    await fetch(`/api/sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, parts_needed: parts }),
    })
  }

  const addPart = () => {
    if (!newPart.trim()) return
    setParts(p => [...p, newPart.trim()])
    setNewPart('')
  }

  if (ended) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-ink-400 text-sm">Wrapping up session…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-ink-950">
      {/* Left: Video */}
      <div className="flex-1 flex flex-col p-4 gap-4">
        {/* Session header */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-ink-500">{(session.category as any)?.name}</p>
            <h1 className="text-sm font-medium text-ink-200 truncate">{session.problem_title}</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-green-400 font-medium">Live</span>
          </div>
        </div>

        {/* Video */}
        <VideoCall
          sessionId={session.id}
          isExpert={isExpert}
          onSessionEnd={handleEnd}
        />

        {/* Pre-session photos (always visible below video) */}
        <div className="card p-4">
          <p className="text-xs font-medium text-ink-500 mb-3">Pre-session photos</p>
          <PhotoPanel sessionId={session.id} userId={userId} stage="pre" />
        </div>
      </div>

      {/* Right: Side panel */}
      <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-ink-800 flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-ink-800">
          {(['photos', 'chat', ...(isExpert ? ['notes'] : [])] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 text-xs font-medium capitalize transition-colors
                ${tab === t ? 'text-white border-b-2 border-brand-500' : 'text-ink-500 hover:text-ink-300'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {tab === 'photos' && (
            <div className="p-4 flex-1 overflow-y-auto">
              <p className="text-xs text-ink-500 mb-3">Share photos during the session</p>
              <PhotoPanel sessionId={session.id} userId={userId} stage="during" />
            </div>
          )}

          {tab === 'chat' && (
            <div className="flex-1 min-h-0">
              <ChatPanel sessionId={session.id} userId={userId} />
            </div>
          )}

          {tab === 'notes' && isExpert && (
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              <div>
                <label className="label">Diagnosis &amp; notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  onBlur={saveNotes}
                  className="input min-h-[120px] resize-none text-xs"
                  placeholder="Diagnosis, steps taken, recommendations…"
                />
              </div>
              <div>
                <label className="label">Parts needed</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {parts.map((p, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs bg-ink-800 text-ink-300 px-2 py-1 rounded-full">
                      {p}
                      <button onClick={() => setParts(ps => ps.filter((_, j) => j !== i))}
                        className="text-ink-500 hover:text-red-400 ml-0.5">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input className="input text-xs py-2" placeholder="Add part…"
                    value={newPart} onChange={e => setNewPart(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addPart()} />
                  <button onClick={addPart} className="btn-ghost text-xs py-2 px-3">Add</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
