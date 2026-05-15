import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'

export const metadata = { title: 'Customer Management — TightSpotHelper Admin' }

export default async function AdminCustomers({
  searchParams,
}: {
  searchParams: { q?: string; page?: string }
}) {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')
  if ((session.user as any).role !== 'admin') redirect('/customer/dashboard')

  const q    = searchParams.q ?? ''
  const page = Math.max(1, parseInt(searchParams.page ?? '1'))
  const take = 25
  const skip = (page - 1) * take

  const where = q
    ? {
        role: 'customer' as const,
        OR: [
          { name:  { contains: q, mode: 'insensitive' as const } },
          { email: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : { role: 'customer' as const }

  const [customers, total] = await Promise.all([
    prisma.authUser.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      select: {
        id: true, name: true, email: true, phone: true,
        createdAt: true, emailVerified: true, stripeCustomerId: true,
        customerSessions: {
          select: { customerTotal: true, status: true },
        },
      },
    }),
    prisma.authUser.count({ where }),
  ])

  const pages = Math.ceil(total / take)

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-white">Customers</h1>
        <span className="text-sm text-ink-500">{total} total</span>
      </div>

      {/* Search */}
      <form className="mb-6">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name or email…"
          className="input w-full max-w-sm"
        />
      </form>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-800">
            <tr className="text-left text-xs text-ink-500">
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Sessions</th>
              <th className="px-4 py-3 font-medium">Total spent</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800/50">
            {customers.map(c => {
              const spent    = c.customerSessions
                .filter(s => s.status === 'completed')
                .reduce((sum, s) => sum + Number(s.customerTotal ?? 0), 0)
              const sessions = c.customerSessions.length

              return (
                <tr key={c.id} className="hover:bg-ink-900/40 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/customers/${c.id}`}
                      className="font-medium text-white hover:text-brand-400 transition-colors">
                      {c.name ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-400">{c.email}</td>
                  <td className="px-4 py-3 text-ink-400">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-300">{sessions}</td>
                  <td className="px-4 py-3 text-brand-400">${spent.toFixed(2)}</td>
                  <td className="px-4 py-3 text-ink-500 text-xs">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      c.emailVerified
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                    }`}>
                      {c.emailVerified ? 'verified' : 'unverified'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {customers.length === 0 && (
          <p className="text-center text-ink-500 text-sm py-12">No customers found</p>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex gap-2 mt-4 justify-end">
          {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
            <Link key={p} href={`?q=${q}&page=${p}`}
              className={`w-8 h-8 flex items-center justify-center rounded text-xs
                ${p === page
                  ? 'bg-brand-500 text-white'
                  : 'bg-ink-800 text-ink-400 hover:bg-ink-700'}`}>
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
