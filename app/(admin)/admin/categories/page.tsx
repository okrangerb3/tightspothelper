import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import CategoryEditor from './CategoryEditor'

export default async function AdminCategories() {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')
  if ((session.user as any).role !== 'admin') redirect('/customer/dashboard')

  const rawCats = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } })
  const categories = rawCats.map(c => ({
    ...c,
    feeValue: Number(c.feeValue),
    rateMin:  Number(c.rateMin),
    rateMax:  Number(c.rateMax),
  }))

  return (
    <div className="p-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-white">Category fees</h1>
          <p className="text-ink-400 text-sm mt-1">Set fee type, value, and rate guardrails per category. Changes apply to all new bookings immediately.</p>
        </div>
        <CategoryEditor categories={categories} />
    </div>
  )
}
