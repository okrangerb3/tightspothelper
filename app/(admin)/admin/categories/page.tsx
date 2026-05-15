import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import CategoryEditor from './CategoryEditor'
import Link from 'next/link'

export const metadata = { title: 'Categories — TightSpotHelper Admin' }

export default async function AdminCategories() {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')
  if ((session.user as any).role !== 'admin') redirect('/customer/dashboard')

  const [rawCats, pendingRequests] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }),
    (prisma as any).categoryRequest.count({ where: { status: 'pending' } }),
  ])

  const categories = rawCats.map(c => ({
    id:           c.id,
    name:         c.name,
    slug:         c.slug,
    description:  c.description ?? null,
    icon:         c.icon ?? null,
    feeType:      c.feeType,
    feeValue:     Number(c.feeValue),
    feeFlatTiers: c.feeFlatTiers as Record<string, number> | null,
    active:       c.active,
  }))

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Categories</h1>
          <p className="text-ink-400 text-sm mt-1">
            Manage service categories and platform fees. Pros set their own rates.
          </p>
        </div>
        {pendingRequests > 0 && (
          <Link href="/admin/category-requests"
            className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20
              text-yellow-400 text-xs font-medium px-3 py-2 rounded-xl hover:bg-yellow-500/20 transition-colors">
            <span className="w-4 h-4 bg-yellow-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
              {pendingRequests}
            </span>
            Pending requests
          </Link>
        )}
      </div>
      <CategoryEditor categories={categories} />
    </div>
  )
}
