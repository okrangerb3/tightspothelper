#!/usr/bin/env bash
# Mobile-first Shell update — bottom tab bar + responsive layouts
set -e
if [ ! -f package.json ] || ! grep -q "tightspothelper" package.json 2>/dev/null; then
  echo "⚠️  Run from the repo root." >&2; exit 1
fi

echo "→ writing components/shell/Shell.tsx (mobile bottom nav)"
cat > "components/shell/Shell.tsx" << 'TSH_EOF_MARKER'
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import NotificationBell from '@/components/shell/NotificationBell'

interface NavItem { href: string; label: string; icon: string }

const NAV: Record<string, NavItem[]> = {
  customer: [
    { href: '/customer/dashboard',       label: 'Home',     icon: '◈' },
    { href: '/customer/book',            label: 'Get Help', icon: '＋' },
    { href: '/customer/sessions',        label: 'Sessions', icon: '▤' },
    { href: '/customer/payment-methods', label: 'Billing',  icon: '◎' },
    { href: '/customer/profile',         label: 'Profile',  icon: '◉' },
  ],
  expert: [
    { href: '/expert/dashboard', label: 'Home',     icon: '◈' },
    { href: '/expert/sessions',  label: 'Sessions', icon: '▤' },
    { href: '/expert/earnings',  label: 'Earnings', icon: '◎' },
    { href: '/expert/profile',   label: 'Profile',  icon: '◉' },
  ],
  admin: [
    { href: '/admin/dashboard',     label: 'Overview',   icon: '◈' },
    { href: '/admin/sessions',      label: 'Sessions',   icon: '▤' },
    { href: '/admin/pros',          label: 'Pros',       icon: '◉' },
    { href: '/admin/customers',     label: 'Customers',  icon: '◍' },
    { href: '/admin/financials',    label: 'Financials', icon: '◐' },
    { href: '/admin/categories',    label: 'Categories', icon: '◧' },
    { href: '/admin/fee-overrides', label: 'Promos',     icon: '◑' },
    { href: '/admin/recordings',    label: 'Recordings', icon: '◷' },
  ],
}

interface SidebarProps { role: 'customer' | 'expert' | 'admin'; userName?: string }

export function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const items    = NAV[role] ?? []

  const signOut = async () => {
    await authClient.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="flex flex-col w-56 min-h-screen bg-ink-950 border-r border-ink-800 px-3 py-5 shrink-0">
      {/* Logo + Bell */}
      <div className="flex items-center justify-between mb-8 px-2">
        <Link href="/" className="font-display font-bold text-white text-base tracking-tight">
          TightSpot<span className="text-brand-500">Helper</span>
        </Link>
        <NotificationBell role={role} />
      </div>

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
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-2.5 px-2 py-2.5 rounded-lg text-sm transition-all duration-150
                ${active ? 'bg-ink-800 text-white font-medium' : 'text-ink-400 hover:text-ink-200 hover:bg-ink-900'}`}>
              <span className="text-xs w-4 text-center opacity-60">{item.icon}</span>
              {item.label}
              {active && <span className="ml-auto w-1 h-4 bg-brand-500 rounded-full" />}
            </Link>
          )
        })}
      </nav>

      {/* User + sign out */}
      <div className="mt-4 border-t border-ink-800 pt-4">
        {userName && <p className="px-2 text-xs text-ink-500 truncate mb-2">{userName}</p>}
        <button onClick={signOut}
          className="w-full text-left px-2 py-2 text-xs text-ink-500 hover:text-red-400 transition-colors rounded-lg hover:bg-ink-900">
          Sign out
        </button>
      </div>
    </aside>
  )
}

/** Mobile bottom tab bar — shown on small screens only */
export function BottomNav({ role }: { role: 'customer' | 'expert' | 'admin' }) {
  const pathname = usePathname()
  const router   = useRouter()
  // Only show top 5 items for bottom nav
  const items = (NAV[role] ?? []).slice(0, 5)

  const signOut = async () => {
    await authClient.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-ink-950 border-t border-ink-800
      flex items-stretch lg:hidden safe-area-bottom"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {items.map(item => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link key={item.href} href={item.href}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px]
              transition-colors ${active ? 'text-brand-400' : 'text-ink-500'}`}>
            <span className={`text-base leading-none ${active ? 'text-brand-400' : 'text-ink-500'}`}>
              {item.icon}
            </span>
            <span className="text-[10px] font-medium leading-none">{item.label}</span>
            {active && <span className="w-4 h-0.5 bg-brand-500 rounded-full mt-0.5" />}
          </Link>
        )
      })}
    </nav>
  )
}

/** Mobile top bar — logo + bell + optional back button */
export function MobileTopBar({ role, userName }: { role: 'customer' | 'expert' | 'admin'; userName?: string }) {
  const router = useRouter()
  return (
    <header className="lg:hidden sticky top-0 z-40 bg-ink-950/95 backdrop-blur border-b border-ink-800
      flex items-center justify-between px-4 h-14">
      <Link href={`/${role}/dashboard`}
        className="font-display font-bold text-white text-sm tracking-tight">
        TightSpot<span className="text-brand-500">Helper</span>
      </Link>
      <div className="flex items-center gap-3">
        <NotificationBell role={role} />
      </div>
    </header>
  )
}

export function StatCard({ label, value, sub, accent = false }: {
  label: string; value: string; sub?: string; accent?: boolean
}) {
  return (
    <div className={`rounded-xl p-4 border ${accent ? 'bg-brand-500/10 border-brand-500/20' : 'bg-ink-900 border-ink-800'}`}>
      <p className="text-xs text-ink-500 mb-1">{label}</p>
      <p className={`font-display text-xl sm:text-2xl font-bold ${accent ? 'text-brand-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-ink-500 mt-0.5">{sub}</p>}
    </div>
  )
}

/** Page shell — sidebar on desktop, bottom nav on mobile */
export function PageShell({ role, userName, children }: {
  role: 'customer' | 'expert' | 'admin'; userName?: string; children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-ink-950">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <Sidebar role={role} userName={userName} />
      </div>

      {/* Mobile top bar */}
      <MobileTopBar role={role} userName={userName} />

      {/* Main content — extra bottom padding on mobile for bottom nav */}
      <main className="flex-1 overflow-y-auto pb-20 lg:pb-0
        pt-14 lg:pt-0">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <BottomNav role={role} />
    </div>
  )
}
TSH_EOF_MARKER


# ── Patch tailwind.config to ensure safe-area utilities work ─────────────────
echo "→ checking tailwind config for safe-area support"
if ! grep -q "safe-area" tailwind.config.ts 2>/dev/null; then
  echo "  (safe-area classes are used inline via style prop — no config change needed)"
fi

# ── Patch globals.css — ensure touch targets and mobile font sizes ───────────
echo "→ patching globals.css for mobile touch targets"
if ! grep -q "touch-action" app/globals.css; then
cat >> app/globals.css << 'CSSEOF'

/* ── Mobile optimisations ─────────────────────────────────── */
/* Prevent iOS font size inflation */
html { -webkit-text-size-adjust: 100%; }

/* Minimum touch target size */
button, a, [role="button"] { min-height: 44px; }

/* Prevent double-tap zoom on buttons */
button { touch-action: manipulation; }

/* Safe area padding for bottom nav */
.safe-area-bottom { padding-bottom: env(safe-area-inset-bottom); }
CSSEOF
fi

echo ""
echo "✓ Mobile shell applied. Changes:"
echo "  • Bottom tab bar on mobile (hidden on lg+)"
echo "  • Sticky top bar on mobile with logo + notification bell"
echo "  • Desktop sidebar unchanged"
echo "  • Main content padded to clear bottom nav (pb-20 mobile, pb-0 desktop)"
echo "  • Minimum 44px touch targets enforced via CSS"
echo "  • iOS text size inflation prevented"
echo ""
echo "Now run:"
echo "  git add -A && git commit -m 'Mobile-first shell: bottom tab nav, responsive layout' && git push"
