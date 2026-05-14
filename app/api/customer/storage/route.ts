import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: sub } = await supabase
    .from('storage_subscriptions')
    .select('tier, storage_used_bytes, storage_limit_bytes, cancelled_at')
    .eq('user_id', user.id)
    .is('cancelled_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({
    tier:       sub?.tier ?? 'free',
    usedBytes:  sub?.storage_used_bytes ?? 0,
    limitBytes: sub?.storage_limit_bytes ?? 0,
  })
}
