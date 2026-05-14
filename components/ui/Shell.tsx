'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface NavItem { href: string; label: string; icon: string }

const NAV: Record<string, NavItem[]> = {
  customer: [
    { href: '/customer/dashboard',       label: 'Dashboard',   icon: '◈' },
    { href: '/customer/book',            label: 'Get help',    icon: '＋' },
    { href: '/customer/sessions',        label: 'Sessions',    icon: '▤' },
    { href: '/customer/storage',         label: 'Storage',     icon: '◷' },
    { href: '/customer/payment-methods', label: 'Billing',     icon: '◎' },
    { href: '/customer/profile',         label: 'Profile',     icon: '◉' },
  ],
  expert: [
    { href: '/expert/dashboard',   label: 'Dashboard',   icon: '◈' },
    { href: '/expert/sessions',    label: 'Sessions',    icon: '▤' },
    { href: '/expert/earnings',    label: 'Earnings',    icon: '◎' },
    { href: '/expert/profile',     label: 'Profile',     icon: '◉' },
  ],
  admin: [
    { href: '/admin/dashboard',    label: 'Overview',    icon: '◈' },
    { href: '/admin/sessions',     label: 'Sessions',    icon: '▤' },
    { href: '/admin/pros',         label: 'Pros',        icon: '◉' },
    { href: '/admin/categories',   label: 'Categories',  icon: '◧' },
    { href: '/admin/fee-overrides',label: 'Promos',      icon: '◐' },
    { href: '/admin/recordings',   label: 'Recordings',  icon: '◷' },
  ],
}

interface SidebarProps { role: 'customer' | 'expert' | 'admin'; userName?: string }

export function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const items    = NAV[role] ?? []

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="flex flex-col w-56 min-h-screen bg-ink-950 border-r border-ink-800 px-3 py-5 shrink-0">
      {/* Logo */}
      <Link href="/" className="font-display font-bold text-white text-base tracking-tight mb-8 px-2">
        TightSpot<span className="text-brand-500">Helper</span>
      </Link>

      {/* Role badge */}
      <div className="px-2 mb-5">
        <span className="text-[10px] font-medium tracking-widest uppercase text-ink-500">
          {role === 'customer' ? 'Customer' : role === 'expert' ? 'Expert' : 'Admin'}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5">
        {items.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-all duration-150
                ${active
                  ? 'bg-ink-800 text-white font-medium'
                  : 'text-ink-400 hover:text-ink-200 hover:bg-ink-900'
                }`}
            >
              <span className="text-xs w-4 text-center opacity-60">{item.icon}</span>
              {item.label}
              {active && <span className="ml-auto w-1 h-4 bg-brand-500 rounded-full" />}
            </Link>
          )
        })}
      </nav>

      {/* User + sign out */}
      <div className="mt-4 border-t border-ink-800 pt-4">
        {userName && (
          <p className="px-2 text-xs text-ink-500 truncate mb-2">{userName}</p>
        )}
        <button
          onClick={signOut}
          className="w-full text-left px-2 py-2 text-xs text-ink-500 hover:text-red-400 transition-colors rounded-lg hover:bg-ink-900"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}

/** Top-bar stat strip used in dashboard pages */
export function StatCard({ label, value, sub, accent = false }: {
  label: string; value: string; sub?: string; accent?: boolean
}) {
  return (
    <div className={`rounded-xl p-4 border ${accent ? 'bg-brand-500/10 border-brand-500/20' : 'bg-ink-900 border-ink-800'}`}>
      <p className="text-xs text-ink-500 mb-1">{label}</p>
      <p className={`font-display text-2xl font-bold ${accent ? 'text-brand-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-ink-500 mt-0.5">{sub}</p>}
    </div>
  )
}

/** Page shell with sidebar */
export function PageShell({ role, userName, children }: {
  role: 'customer' | 'expert' | 'admin'; userName?: string; children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar role={role} userName={userName} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
