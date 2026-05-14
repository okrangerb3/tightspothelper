'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <p className="text-4xl mb-4">⚠️</p>
        <h1 className="font-display text-2xl font-bold text-white mb-2">Something went wrong</h1>
        <p className="text-ink-400 text-sm mb-8">An unexpected error occurred. Try refreshing or go back.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="btn-primary">Try again</button>
          <a href="/" className="btn-ghost">Go home</a>
        </div>
      </div>
    </div>
  )
}
