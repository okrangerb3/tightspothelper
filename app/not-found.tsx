import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <p className="font-mono text-6xl text-ink-800 font-bold mb-4">404</p>
        <h1 className="font-display text-2xl font-bold text-white mb-2">Page not found</h1>
        <p className="text-ink-400 text-sm mb-8">The page you're looking for doesn't exist or has been moved.</p>
        <Link href="/" className="btn-primary">Go home</Link>
      </div>
    </div>
  )
}
