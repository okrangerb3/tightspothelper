import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const admin    = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { category_id, override_value, starts_at, ends_at } = await req.json()

  if (!category_id || override_value == null || !starts_at || !ends_at)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

  if (new Date(starts_at) >= new Date(ends_at))
    return NextResponse.json({ error: 'starts_at must be before ends_at' }, { status: 400 })

  const { data, error } = await admin.from('fee_overrides').insert({
    category_id,
    override_value: parseFloat(override_value),
    starts_at,
    ends_at,
    created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ override: data })
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data } = await supabase
    .from('fee_overrides')
    .select('*, category:category_id(name)')
    .order('starts_at', { ascending: false })

  return NextResponse.json({ overrides: data ?? [] })
}
