'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

interface RecordingData {
  url: string
  expiresAt: string | null
  purchaseStatus: 'free_window' | 'purchased' | 'expired' | 'deleted'
}

export default function RecordingPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams()
  const autoKeep     = searchParams.get('action') === 'keep'

  const [recording, setRecording]   = useState<RecordingData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [purchasing, setPurchasing] = useState(false)
  const [purchased, setPurchased]   = useState(false)

  useEffect(() => {
    fetch(`/api/recordings/${params.id}/url`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setRecording(data)
        setLoading(false)
      })
      .catch(() => { setError('Failed to load recording'); setLoading(false) })
  }, [params.id])

  useEffect(() => {
    if (!loading && autoKeep && recording?.purchaseStatus === 'free_window' && !purchasing && !purchased && !error) {
      void handleKeep()
    }
  }, [loading, autoKeep, recording?.purchaseStatus, purchasing, purchased, error])

  const handleKeep = async () => {
    setPurchasing(true)
    const res  = await fetch(`/api/recordings/${params.id}/purchase`, { method: 'POST' })
    const data = await res.json()
    if (data.ok) {
      setPurchased(true)
      setRecording(r => r ? { ...r, purchaseStatus: 'purchased', expiresAt: null } : r)
    }
    setPurchasing(false)
  }

  const daysLeft = recording?.expiresAt
    ? Math.ceil((new Date(recording.expiresAt).getTime() - Date.now()) / 86400000) : null

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-64">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="p-8 max-w-lg">
      <div className="card p-8 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <Link href={`/customer/sessions/${params.id}/summary`} className="btn-ghost">← Back to session</Link>
      </div>
    </div>
  )

  return (
    <div className="p-8 max-w-3xl">
      <Link href={`/customer/sessions/${params.id}/summary`}
        className="text-xs text-ink-500 hover:text-ink-300 transition-colors mb-6 flex items-center gap-1">
        ← Back to session
      </Link>

      <h1 className="font-display text-2xl font-bold text-white mb-6">Session recording</h1>

      {/* Video player */}
      <div className="card overflow-hidden mb-4">
        <video
          src={recording?.url}
          controls
          className="w-full aspect-video bg-black"
          controlsList="nodownload"
        />
      </div>

      {/* Expiry / keep CTA */}
      {recording?.purchaseStatus === 'free_window' && !purchased && (
        <div className={`card p-5 mb-4 ${daysLeft !== null && daysLeft <= 5 ? 'border-yellow-500/30 bg-yellow-500/5' : ''}`}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium text-white">
                {daysLeft !== null && daysLeft > 0
                  ? `Recording expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`
                  : 'Recording has expired'}
              </p>
              <p className="text-xs text-ink-500 mt-0.5">Keep it forever for a one-time fee</p>
            </div>
            <button onClick={handleKeep} disabled={purchasing} className="btn-primary shrink-0">
              {purchasing
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Keep forever · $2.99'}
            </button>
          </div>
        </div>
      )}

      {(recording?.purchaseStatus !== 'free_window' || purchased) && (
        <div className="card p-4 flex items-center gap-3">
          <span className="text-green-400">✓</span>
          <p className="text-sm text-ink-200">This recording is saved permanently to your account</p>
        </div>
      )}

      {/* Download link (only for paid) */}
      {recording?.purchaseStatus === 'purchased' && recording?.url && (
        <div className="mt-3">
          <a href={recording.url} download className="btn-ghost text-sm">
            Download recording
          </a>
        </div>
      )}
    </div>
  )
}
