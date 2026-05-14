import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getDownloadUrl } from '@/lib/r2'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: rec } = await admin.from('recordings')
    .select('r2_key,r2_admin_key,session_id,plan,deleted_at,expires_at')
    .eq('id', params.id).single()

  if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (rec.deleted_at) return NextResponse.json({ error: 'Recording has been deleted' }, { status: 410 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  // Verify participant if not admin
  if (!isAdmin) {
    const { data: session } = await supabase.from('sessions').select('customer_id,expert_id').eq('id', rec.session_id).single()
    if (!session || (session.customer_id !== user.id && session.expert_id !== user.id))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const key = isAdmin ? rec.r2_admin_key : rec.r2_key
  const url = await getDownloadUrl(key, 3600)
  return NextResponse.json({ url, expiresAt: rec.expires_at, plan: rec.plan })
}
