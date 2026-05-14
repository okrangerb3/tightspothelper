'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RecordingActions({ recordingId, purchaseStatus }: { recordingId: string; purchaseStatus: string }) {
  const router  = useRouter()
  const [open, setOpen]     = useState(false)
  const [loading, setLoading] = useState(false)

  const extend = async () => {
    setLoading(true)
    await fetch(`/api/recordings/${recordingId}/extend`, { method: 'POST' })
    setLoading(false); setOpen(false); router.refresh()
  }

  const getLink = async () => {
    const res  = await fetch(`/api/recordings/${recordingId}/url`)
    const { url } = await res.json()
    window.open(url, '_blank')
    setOpen(false)
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="text-xs px-2 py-1 rounded-lg border border-ink-700 text-ink-400 hover:text-ink-200 hover:border-ink-600 transition-colors">
        ···
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-7 z-20 card py-1 w-40 shadow-xl">
            <button onClick={getLink}
              className="w-full text-left px-4 py-2 text-xs text-ink-300 hover:bg-ink-800 hover:text-white transition-colors">
              Get download link
            </button>
            {purchaseStatus === 'free_window' && (
              <button onClick={extend} disabled={loading}
                className="w-full text-left px-4 py-2 text-xs text-ink-300 hover:bg-ink-800 hover:text-white transition-colors disabled:opacity-50">
                {loading ? 'Extending…' : 'Extend 30 days'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
