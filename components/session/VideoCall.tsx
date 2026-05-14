'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import DailyIframe, { DailyCall } from '@daily-co/daily-js'

interface VideoCallProps {
  roomUrl:   string
  token:     string
  sessionId: string
  isExpert:  boolean
  onSessionEnd: (durationSeconds: number) => void
}

export default function VideoCall({ roomUrl, token, sessionId, isExpert, onSessionEnd }: VideoCallProps) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const callRef       = useRef<DailyCall | null>(null)
  const [status, setStatus]       = useState<'loading' | 'connected' | 'error'>('loading')
  const [duration, setDuration]   = useState(0)
  const [recording, setRecording] = useState(false)
  const timerRef = useRef<NodeJS.Timeout>()
  const startTimeRef = useRef<number>()

  useEffect(() => {
    if (!containerRef.current) return

    const call = DailyIframe.createFrame(containerRef.current, {
      showLeaveButton: false,   // we control end session ourselves
      showFullscreenButton: true,
      iframeStyle: { width: '100%', height: '100%', border: 'none', borderRadius: '12px' },
    })

    callRef.current = call

    call
      .on('joined-meeting', () => {
        setStatus('connected')
        startTimeRef.current = Date.now()

        // Start timer
        timerRef.current = setInterval(() => {
          setDuration(Math.floor((Date.now() - startTimeRef.current!) / 1000))
        }, 1000)

        // Expert automatically starts cloud recording
        if (isExpert) {
          call.startRecording({ layout: { preset: 'active-participant' } })
          setRecording(true)
        }
      })
      .on('left-meeting', () => handleEnd())
      .on('error', () => setStatus('error'))

    call.join({ url: roomUrl, token })

    return () => {
      clearInterval(timerRef.current)
      call.destroy()
    }
  }, [roomUrl, token])

  const handleEnd = useCallback(async () => {
    clearInterval(timerRef.current)
    const secs = Math.floor((Date.now() - (startTimeRef.current ?? Date.now())) / 1000)

    if (isExpert && callRef.current) {
      await callRef.current.stopRecording()
    }

    callRef.current?.leave()
    onSessionEnd(secs)
  }, [isExpert, onSessionEnd])

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 rounded-xl">
          <p className="text-white/50 text-sm">Connecting...</p>
        </div>
      )}

      <div ref={containerRef} className="w-full h-full" />

      {status === 'connected' && (
        <>
          {/* Timer */}
          <div className="absolute top-3 left-3 bg-black/60 text-white text-xs font-mono px-2 py-1 rounded-md">
            {fmt(duration)}
          </div>

          {/* Recording indicator */}
          {recording && (
            <div className="absolute top-3 left-20 bg-red-600/90 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              REC
            </div>
          )}

          {/* End session */}
          <button
            onClick={handleEnd}
            className="absolute top-3 right-3 bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
          >
            End session
          </button>
        </>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 rounded-xl">
          <p className="text-red-400 text-sm">Connection failed. Please refresh.</p>
        </div>
      )}
    </div>
  )
}
