import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('admin')
  if (error) return error

  const { action, reason } = await req.json()
  const userId = params.id

  const user = await prisma.authUser.findUnique({
    where:  { id: userId },
    select: { id: true, email: true, name: true, role: true, stripeCustomerId: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (user.role === 'admin') return NextResponse.json({ error: 'Cannot modify admin accounts' }, { status: 403 })

  switch (action) {
    case 'disable':
      await prisma.authUser.update({
        where: { id: userId },
        data:  { banned: true, banReason: reason ?? 'Disabled by admin' } as any,
      })
      return NextResponse.json({ ok: true, message: `${user.name ?? user.email} disabled` })

    case 'enable':
      await prisma.authUser.update({
        where: { id: userId },
        data:  { banned: false, banReason: null } as any,
      })
      return NextResponse.json({ ok: true, message: `${user.name ?? user.email} re-enabled` })

    case 'delete':
      // Cancel any active sessions
      await prisma.session.updateMany({
        where:  { customerId: userId, status: { in: ['pending', 'active'] } },
        data:   { status: 'cancelled', cancelledReason: 'Account deleted by admin' },
      })
      // Detach Stripe payment methods if customer exists
      if (user.stripeCustomerId) {
        try {
          const methods = await stripe.paymentMethods.list({ customer: user.stripeCustomerId, type: 'card' })
          await Promise.allSettled(methods.data.map(m => stripe.paymentMethods.detach(m.id)))
          await stripe.customers.del(user.stripeCustomerId)
        } catch (e) { console.error('Stripe cleanup error:', e) }
      }
      await prisma.authUser.delete({ where: { id: userId } })
      return NextResponse.json({ ok: true, message: `${user.name ?? user.email} deleted` })

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
