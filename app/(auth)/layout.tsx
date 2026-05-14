import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Minimal nav */}
      <nav className="container-page flex items-center justify-between py-5">
        <Link href="/" className="font-display text-lg font-bold text-white tracking-tight">
          TightSpot<span className="text-brand-500">Helper</span>
        </Link>
      </nav>

      {/* Centered content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        {children}
      </div>
    </div>
  )
}
