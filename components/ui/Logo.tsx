import Link from 'next/link'

/** SVG logomark + wordmark for TightSpotHelper */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#f97c0a" />

      {/* House outline */}
      <path
        d="M6.75 15.25 16 7.75l9.25 7.5V24a1.25 1.25 0 0 1-1.25 1.25H8A1.25 1.25 0 0 1 6.75 24v-8.75Z"
        stroke="white"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Wrench */}
      <path
        d="M20.6 10.9a3.2 3.2 0 0 0-3.73 4.12l-4.68 4.68a1.35 1.35 0 1 0 1.9 1.91l4.69-4.69a3.2 3.2 0 0 0 4.12-3.73l-1.59 1.59a.85.85 0 0 1-1.2 0l-.9-.9a.85.85 0 0 1 0-1.2l1.39-1.38Z"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Door */}
      <rect x="14.3" y="18.6" width="3.4" height="6.65" rx="1" fill="white" />
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
