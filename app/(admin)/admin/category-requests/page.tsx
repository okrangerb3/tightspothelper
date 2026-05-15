import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import AdminCategoryRequestsClient from './AdminCategoryRequestsClient'

export const metadata = { title: 'Category Requests — Admin' }

export default async function AdminCategoryRequestsPage() {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')
  if ((session.user as any).role !== 'admin') redirect('/customer/dashboard')

  const requests = await (prisma as any).categoryRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true, email: true } } },
  })

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Category requests</h1>
          <p className="text-sm text-ink-500 mt-1">Customers requesting service categories not yet on the platform</p>
        </div>
        <span className="text-xs bg-brand-500/10 text-brand-400 border border-brand-500/20 px-2.5 py-1 rounded-full">
          {requests.filter((r: any) => r.status === 'pending').length} pending
        </span>
      </div>
      <AdminCategoryRequestsClient requests={requests} />
    </div>
  )
}
