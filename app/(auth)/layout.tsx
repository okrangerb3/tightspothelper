import { Logo } from '@/components/ui/Logo'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-950 flex flex-col">
      <nav className="container-page flex items-center justify-between py-5">
        <Logo />
      </nav>

      <div className="flex-1 container-page w-full py-8 sm:py-12">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 items-stretch">
          <section className="hidden lg:flex card relative overflow-hidden min-h-[560px] p-8 xl:p-10">
            <div
              className="absolute -top-20 -left-20 h-64 w-64 rounded-full blur-3xl"
              style={{ background: 'radial-gradient(circle, rgba(249,124,10,0.25) 0%, rgba(249,124,10,0) 70%)' }}
            />
            <div
              className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full blur-3xl"
              style={{ background: 'radial-gradient(circle, rgba(249,124,10,0.18) 0%, rgba(249,124,10,0) 70%)' }}
            />

            <div className="relative z-10 flex flex-col w-full justify-between">
              <div>
                <p className="text-brand-400 text-xs tracking-[0.18em] uppercase mb-4">Remote Repair Guidance</p>
                <h1 className="font-display text-4xl xl:text-5xl leading-tight text-white max-w-md">
                  Show the issue.
                  <br />
                  Get a fix plan.
                </h1>
                <p className="text-ink-300 text-sm mt-4 max-w-md">
                  Book trusted experts for plumbing, electrical, HVAC, and more with live video diagnosis.
                </p>
              </div>

              <div className="surface p-5">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { title: 'Plumbing', icon: 'ti-droplet' },
                    { title: 'Electrical', icon: 'ti-bolt' },
                    { title: 'HVAC', icon: 'ti-wind' },
                    { title: 'Handyman', icon: 'ti-tool' },
                  ].map(item => (
                    <div key={item.title} className="rounded-xl border border-ink-700 bg-ink-900/70 px-3 py-2.5 flex items-center gap-2.5">
                      <span className="h-7 w-7 rounded-lg bg-brand-500/15 text-brand-400 flex items-center justify-center">
                        <i className={`${item.icon} text-sm`} aria-hidden="true" />
                      </span>
                      <span className="text-xs text-ink-200 font-medium">{item.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center px-1 sm:px-4 lg:px-6">
            <div className="w-full max-w-lg">{children}</div>
          </section>
        </div>
      </div>
    </div>
  )
}
