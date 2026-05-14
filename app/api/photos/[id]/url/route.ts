import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getDownloadUrl } from '@/lib/r2'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: photo } = await supabase.from('session_photos').select('storage_path,session_id').eq('id', params.id).single()
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Verify participant
  const { data: session } = await supabase.from('sessions').select('customer_id,expert_id').eq('id', photo.session_id).single()
  if (!session || (session.customer_id !== user.id && session.expert_id !== user.id)) {
    // Check admin
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = await getDownloadUrl(photo.storage_path)
  return NextResponse.json({ url })
}
