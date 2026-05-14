import Link from 'next/link'

/** SVG logomark + wordmark for TightSpotHelper */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      {/* Rounded square background */}
      <rect width="32" height="32" rx="8" fill="#f97c0a" />
      {/* Wrench icon (white) */}
      <path
        d="M22.5 8.5a4.5 4.5 0 0 0-4.37 5.57L11 21.2a1.5 1.5 0 1 0 2.12 2.12l7.13-7.13A4.5 4.5 0 0 0 22.5 8.5Zm0 2a2.5 2.5 0 0 1 .63.08l-1.8 1.8a1 1 0 0 0 0 1.41l.88.88a1 1 0 0 0 1.41 0l1.8-1.8c.05.2.08.41.08.63a2.5 2.5 0 0 1-2.5 2.5 2.5 2.5 0 0 1-.63-.08l.05-.05a1 1 0 0 0-.05-1.36l-.88-.88a1 1 0 0 0-1.41 0l-.05.05A2.5 2.5 0 0 1 20 13a2.5 2.5 0 0 1 2.5-2.5Z"
        fill="white"
      />
      {/* House outline (white) */}
      <path
        d="M7 16.5 12 12l5 4.5V24H9v-4.5H7Z"
        stroke="white"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

export function Logo({ href = '/', className = '' }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`flex items-center gap-2.5 select-none ${className}`}>
      <LogoMark size={28} />
      <span className="font-display text-lg font-bold text-white tracking-tight leading-none">
        TightSpot<span className="text-brand-500">Helper</span>
      </span>
    </Link>
  )
}
