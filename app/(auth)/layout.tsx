import { Logo } from '@/components/ui/Logo'

const CATEGORIES = [
  { title: 'Plumbing',    icon: 'ti-droplet' },
  { title: 'Electrical',  icon: 'ti-bolt' },
  { title: 'HVAC',        icon: 'ti-wind' },
  { title: 'Handyman',    icon: 'ti-tool' },
  { title: 'Automotive',  icon: 'ti-car' },
  { title: 'Appliances',  icon: 'ti-washing-machine' },
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-950 flex flex-col">
      <nav className="container-page flex items-center justify-between py-5 shrink-0">
        <Logo />
      </nav>

      <div className="flex-1 container-page w-full py-8 sm:py-12 flex items-center">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 w-full items-stretch">

          {/* Left panel — hidden on mobile */}
          <section className="hidden lg:flex card relative overflow-hidden min-h-[580px] p-8 xl:p-10">
            {/* Glow blobs */}
            <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full blur-3xl pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(249,124,10,0.25) 0%, rgba(249,124,10,0) 70%)' }} />
            <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full blur-3xl pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(249,124,10,0.18) 0%, rgba(249,124,10,0) 70%)' }} />

            {/* Content — vertically centered */}
            <div className="relative z-10 flex flex-col w-full justify-center gap-8">
              {/* Headline */}
              <div>
                <p className="text-brand-400 text-xs tracking-[0.18em] uppercase mb-4">
                  Remote Repair Guidance
                </p>
                <h1 className="font-display text-4xl xl:text-5xl leading-tight text-white max-w-md">
                  Show the issue.<br />Get a fix plan.
                </h1>
                <p className="text-ink-300 text-sm mt-4 max-w-md leading-relaxed">
                  Book trusted experts for plumbing, electrical, HVAC, automotive, and more
                  — with live video diagnosis in minutes.
                </p>
              </div>

              {/* Category grid */}
              <div className="surface p-5">
                <p className="text-[10px] text-ink-500 uppercase tracking-widest mb-3">Available categories</p>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(item => (
                    <div key={item.title}
                      className="rounded-xl border border-ink-700 bg-ink-900/70 px-3 py-2.5 flex items-center gap-2.5">
                      <span className="h-7 w-7 rounded-lg bg-brand-500/15 text-brand-400 flex items-center justify-center shrink-0">
                        <i className={`${item.icon} text-sm`} aria-hidden="true" />
                      </span>
                      <span className="text-xs text-ink-200 font-medium">{item.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trust badges */}
              <div className="flex items-center gap-6">
                {[
                  { icon: '✓', label: 'Background checked' },
                  { icon: '⚡', label: 'Available in minutes' },
                  { icon: '🔒', label: 'Secure payments' },
                ].map(b => (
                  <div key={b.label} className="flex items-center gap-1.5">
                    <span className="text-brand-400 text-xs">{b.icon}</span>
                    <span className="text-[11px] text-ink-500">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Right panel — form */}
          <section className="flex items-center justify-center px-1 sm:px-4 lg:px-6">
            <div className="w-full max-w-lg">{children}</div>
          </section>

        </div>
      </div>
    </div>
  )
}
