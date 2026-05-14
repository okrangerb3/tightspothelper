import Link from 'next/link'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

const CATEGORIES = [
  { icon: '🔧', name: 'Plumbing',   desc: 'Leaks, drains, fixtures' },
  { icon: '⚡', name: 'Electrical', desc: 'Outlets, panels, wiring' },
  { icon: '❄️', name: 'HVAC',       desc: 'Heating & cooling' },
  { icon: '🏠', name: 'Appliances', desc: 'Washers, fridges, dryers' },
  { icon: '🪚', name: 'Carpentry',  desc: 'Doors, trim, furniture' },
  { icon: '🔨', name: 'Handyman',   desc: 'Everything else' },
]

const STEPS = [
  { n: '01', title: 'Describe the problem', body: "Tell us what's broken and upload a few photos so your expert arrives prepared." },
  { n: '02', title: 'Match with a vetted pro', body: 'We connect you with a background-checked expert in your category — usually in minutes.' },
  { n: '03', title: 'Fix it over video', body: 'Join a live video call. Share your screen, your camera, or more photos. Get it sorted.' },
]

export default async function LandingPage() {
  const session = await auth.api.getSession({ headers: headers() })
  if (session?.user) {
    const role = (session.user as any).role ?? 'customer'
    redirect(`/${role}/dashboard`)
  }

  return (
    <div className="min-h-screen">
      {/* ── Nav ─────────────────────────────────────────── */}
      <nav className="container-page flex items-center justify-between py-5">
        <span className="font-display text-xl font-bold text-white tracking-tight">
          TightSpot<span className="text-brand-500">Helper</span>
        </span>
        <div className="flex items-center gap-3">
          <Link href="/login"  className="btn-ghost text-sm py-2 px-4">Sign in</Link>
          <Link href="/signup" className="btn-primary text-sm py-2 px-4">Get help now</Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="container-page pt-16 pb-24 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-medium px-3 py-1.5 rounded-full mb-8 animate-fade-in">
          <span className="w-1.5 h-1.5 bg-brand-400 rounded-full" />
          Vetted experts available now
        </div>

        <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-[1.05] tracking-tight mb-6 animate-fade-up">
          Stuck on something<br />
          <span className="text-brand-500">broken?</span>
        </h1>

        <p className="text-ink-400 text-lg sm:text-xl max-w-xl mx-auto mb-10 animate-fade-up" style={{ animationDelay: '80ms' }}>
          Get a vetted expert on a live video call in minutes. Show them the problem, get it fixed.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-up" style={{ animationDelay: '160ms' }}>
          <Link href="/signup" className="btn-primary text-base px-8 py-3">
            Get help now
          </Link>
          <Link href="/signup?role=expert" className="btn-ghost text-base px-8 py-3">
            Become an expert
          </Link>
        </div>

        <div className="flex items-center justify-center gap-8 mt-14 text-ink-500 text-sm animate-fade-in" style={{ animationDelay: '300ms' }}>
          <span><strong className="text-ink-300">2 min</strong> avg match time</span>
          <span className="w-px h-4 bg-ink-700" />
          <span><strong className="text-ink-300">4.9★</strong> expert rating</span>
          <span className="w-px h-4 bg-ink-700" />
          <span><strong className="text-ink-300">Background</strong> checked pros</span>
        </div>
      </section>

      {/* ── Categories ──────────────────────────────────── */}
      <section className="container-page pb-20">
        <p className="text-xs font-medium text-ink-500 tracking-widest uppercase mb-6 text-center">
          What do you need help with?
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {CATEGORIES.map((cat, i) => (
            <Link
              key={cat.name}
              href={`/signup?category=${cat.name.toLowerCase()}`}
              className="card p-4 text-center hover:border-brand-500/40 hover:bg-ink-800 transition-all duration-200 group animate-fade-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="text-2xl mb-2">{cat.icon}</div>
              <div className="text-sm font-medium text-ink-200 group-hover:text-white transition-colors">{cat.name}</div>
              <div className="text-xs text-ink-500 mt-0.5">{cat.desc}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────── */}
      <section className="border-t border-ink-800 py-20">
        <div className="container-page">
          <h2 className="font-display text-3xl font-bold text-white text-center mb-14">
            How it works
          </h2>
          <div className="grid sm:grid-cols-3 gap-8 stagger">
            {STEPS.map(step => (
              <div key={step.n} className="animate-fade-up">
                <div className="font-mono text-4xl font-medium text-brand-500/30 mb-4">{step.n}</div>
                <h3 className="font-display text-lg font-bold text-white mb-2">{step.title}</h3>
                <p className="text-ink-400 text-sm leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing note ────────────────────────────────── */}
      <section className="border-t border-ink-800 py-20">
        <div className="container-page text-center max-w-2xl mx-auto">
          <h2 className="font-display text-3xl font-bold text-white mb-4">
            Pay only for what you use
          </h2>
          <p className="text-ink-400 mb-8">
            Experts set their own rates. Sessions start from $25/hr. You see the total price before you book — no hidden fees.
          </p>
          <Link href="/signup" className="btn-primary px-8 py-3 text-base">
            Get started free
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="border-t border-ink-800 py-8">
        <div className="container-page flex flex-col sm:flex-row items-center justify-between gap-4 text-ink-600 text-xs">
          <span>© 2025 TightSpotHelper. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-ink-400 transition-colors">Privacy</Link>
            <Link href="/terms"   className="hover:text-ink-400 transition-colors">Terms</Link>
            <Link href="/login"   className="hover:text-ink-400 transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
