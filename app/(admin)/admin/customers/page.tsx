import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import AdminCustomersClient from './AdminCustomersClient'

export const metadata = { title: 'Customers — TightSpotHelper Admin' }

export default async function AdminCustomers({
  searchParams,
}: {
  searchParams: { q?: string; page?: string; status?: string }
}) {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')
  if ((session.user as any).role !== 'admin') redirect('/customer/dashboard')

  const q      = searchParams.q ?? ''
  const status = searchParams.status ?? 'all'
  const page   = Math.max(1, parseInt(searchParams.page ?? '1'))
  const take   = 25
  const skip   = (page - 1) * take

  const where: any = { role: 'customer' }
  if (q) where.OR = [
    { name:  { contains: q, mode: 'insensitive' } },
    { email: { contains: q, mode: 'insensitive' } },
  ]
  if (status === 'disabled') where.banned = true
  if (status === 'active')   where.banned = { not: true }

  const [customers, total] = await Promise.all([
    prisma.authUser.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take, skip,
      select: {
        id: true, name: true, email: true, phone: true,
        createdAt: true, emailVerified: true, stripeCustomerId: true,
        customerSessions: { select: { customerTotal: true, status: true } },
      },
    }) as any,
    prisma.authUser.count({ where }),
  ])

  const serialized = customers.map((c: any) => ({
    ...c,
    banned:    (c as any).banned ?? false,
    createdAt: c.createdAt.toISOString(),
    customerSessions: c.customerSessions.map((s: any) => ({
      customerTotal: Number(s.customerTotal ?? 0),
      status: s.status,
    })),
  }))

  return (
    <AdminCustomersClient
      customers={serialized}
      total={total}
      page={page}
      pages={Math.ceil(total / take)}
      q={q}
      status={status}
    />
  )
}
