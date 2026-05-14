import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { headers } from 'next/headers'
import FeeOverrideManager from './FeeOverrideManager'

export default async function AdminFeeOverridesPage() {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')
  if (session.user.role !== 'admin') redirect('/customer/dashboard')

  const rawCats = await prisma.category.findMany({
    where: { active: true },
    select: { id: true, name: true, feeType: true, feeValue: true },
    orderBy: { name: 'asc' },
  })
  const categories = rawCats.map(c => ({ ...c, feeValue: Number(c.feeValue) }))

  const overrides = await prisma.feeOverride.findMany({
    where: { endsAt: { gte: new Date() } },
    include: { category: { select: { name: true } } },
    orderBy: { startsAt: 'desc' },
  })

  return (
    <div className="p-8 max-w-3xl">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-white">Fee overrides</h1>
          <p className="text-ink-400 text-sm mt-1">
            Create temporary promotional fee reductions. Overrides apply to all new bookings in that category during the period.
          </p>
        </div>
        <FeeOverrideManager categories={categories} overrides={overrides as any} />
    </div>
  )
}
