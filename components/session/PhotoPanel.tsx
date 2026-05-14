'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

interface Photo {
  id:          string
  storagePath: string
  stage:       'pre' | 'during'
  uploadedBy:  string
  url?:        string
}

interface PhotoPanelProps {
  sessionId: string
  userId:    string
  stage:     'pre' | 'during'
}

export default function PhotoPanel({ sessionId, userId, stage }: PhotoPanelProps) {
  const [photos, setPhotos]       = useState<Photo[]>([])
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected]   = useState<Photo | null>(null)
  const fileRef  = useRef<HTMLInputElement>(null)
  const socket   = useRef<Socket | null>(null)
  const knownIds = useRef<Set<string>>(new Set())

  // ── Load existing photos ──────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/photos?sessionId=${sessionId}`)
      const { photos: list } = await res.json()
      if (!list) return
      const withUrls = await Promise.all(
        list.map(async (p: any) => {
          const urlRes = await fetch(`/api/photos/${p.id}/url`)
          const { url } = await urlRes.json()
          return { ...p, storagePath: p.storagePath ?? p.storage_path, uploadedBy: p.uploadedBy ?? p.uploaded_by, url }
        })
      )
      setPhotos(withUrls)
      withUrls.forEach((p: Photo) => knownIds.current.add(p.id))
    }
    load()
  }, [sessionId])

  // ── Socket.IO — listen for photo:added from other participants ──
  useEffect(() => {
    const s = io({ path: '/socket.io', withCredentials: true })
    socket.current = s

    s.emit('session:join', { sessionId })

    s.on('photo:added', async (photo: Photo) => {
      // Skip photos we already know about (our own upload that we added to state immediately)
      if (knownIds.current.has(photo.id)) return
      knownIds.current.add(photo.id)
      // Fetch signed URL for the new photo
      const urlRes = await fetch(`/api/photos/${photo.id}/url`)
      const { url } = await urlRes.json()
      setPhotos(prev => [...prev, { ...photo, url }])
    })

    return () => { s.disconnect(); socket.current = null }
  }, [sessionId])

  // ── Upload handler ────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || uploading) return

    setUploading(true)
    try {
      const res = await fetch('/api/photos/upload-url', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sessionId, stage, fileName: file.name, contentType: file.type }),
      })
      const { uploadUrl, photoId, storagePath } = await res.json()

      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })

      // Fetch signed URL immediately for local display
      const urlRes = await fetch(`/api/photos/${photoId}/url`)
      const { url } = await urlRes.json()

      // Track locally so we ignore the socket:photo:added echo
      knownIds.current.add(photoId)
      setPhotos(prev => [...prev, { id: photoId, storagePath, stage, uploadedBy: userId, url }])
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      {/* Photo strip */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {photos.map(photo => (
          <button
            key={photo.id}
            onClick={() => setSelected(photo)}
            className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 hover:ring-2 ring-blue-500 transition-all"
          >
            {photo.url
              ? <img src={photo.url} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800" />
            }
            <span className={`absolute top-0.5 left-0.5 text-[9px] font-medium px-1 py-0.5 rounded
              ${photo.stage === 'pre'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-green-100 text-green-700'
              }`}>
              {photo.stage === 'pre' ? 'pre' : 'live'}
            </span>
          </button>
        ))}

        {/* Upload button */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex-shrink-0 w-16 h-16 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-zinc-400 hover:border-zinc-400 hover:text-zinc-500 transition-colors disabled:opacity-50"
        >
          {uploading
            ? <span className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
            : <span className="text-2xl leading-none">+</span>
          }
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleUpload}
        className="hidden"
      />

      {/* Lightbox */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <img
            src={selected.url}
            alt=""
            className="max-w-full max-h-full rounded-xl object-contain"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl"
            onClick={() => setSelected(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

