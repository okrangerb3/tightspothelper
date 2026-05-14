'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface VideoCallProps {
  sessionId:    string
  isExpert:     boolean
  onSessionEnd: (durationSeconds: number) => void
}

// Public Jitsi Meet — no API key, no setup, free.
// Room name uses session UUID for privacy.
const JITSI_DOMAIN = 'meet.jit.si'

export default function VideoCall({ sessionId, isExpert, onSessionEnd }: VideoCallProps) {
  const apiRef       = useRef<any>(null)
  const startRef     = useRef<number | null>(null)
  const timerRef     = useRef<NodeJS.Timeout>()
  const [duration, setDuration]   = useState(0)
  const [loaded, setLoaded]       = useState(false)
  const [ending, setEnding]       = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Load the Jitsi external API script dynamically
    const existing = document.getElementById('jitsi-external-api')
    const init = () => {
      if (!containerRef.current || apiRef.current) return

      const api = new (window as any).JitsiMeetExternalAPI(JITSI_DOMAIN, {
        roomName:  `tsh-${sessionId}`,
        parentNode: containerRef.current,
        width:     '100%',
        height:    '100%',
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          disableDeepLinking:  true,
          prejoinPageEnabled:  false,
          toolbarButtons: [
            'microphone', 'camera', 'closedcaptions', 'fullscreen',
            'fodeviceselection', 'hangup', 'chat', 'raisehand', 'tileview',
          ],
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK:   false,
          SHOW_BRAND_WATERMARK:   false,
          SHOW_POWERED_BY:        false,
          DEFAULT_REMOTE_DISPLAY_NAME: 'Participant',
        },
      })

      apiRef.current = api

      api.addEventListeners({
        videoConferenceJoined: () => {
          setLoaded(true)
          startRef.current = Date.now()
          timerRef.current = setInterval(() => {
            setDuration(Math.floor((Date.now() - startRef.current!) / 1000))
          }, 1000)
        },
        videoConferenceLeft: () => {
          handleEnd()
        },
      })
    }

    if (existing) {
      init()
    } else {
      const script = document.createElement('script')
      script.id  = 'jitsi-external-api'
      script.src = `https://${JITSI_DOMAIN}/external_api.js`
      script.async = true
      script.onload = init
      document.head.appendChild(script)
    }

    return () => {
      clearInterval(timerRef.current)
      apiRef.current?.dispose()
      apiRef.current = null
    }
  }, [sessionId])

  const handleEnd = useCallback(() => {
    if (ending) return
    setEnding(true)
    clearInterval(timerRef.current)
    const secs = startRef.current
      ? Math.floor((Date.now() - startRef.current) / 1000)
      : 0
    apiRef.current?.executeCommand('hangup')
    onSessionEnd(secs)
  }, [ending, onSessionEnd])

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="relative w-full bg-zinc-900 rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-white/50 text-sm">Connecting to video…</p>
          </div>
        </div>
      )}

      {/* Jitsi mounts here */}
      <div ref={containerRef} className="w-full h-full" />

      {loaded && (
        <>
          <div className="absolute top-3 left-3 bg-black/60 text-white text-xs font-mono px-2 py-1 rounded-md z-20">
            {fmt(duration)}
          </div>
          <button
            onClick={handleEnd}
            className="absolute top-3 right-3 bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors z-20"
          >
            End session
          </button>
        </>
      )}
    </div>
  )
}
