import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('categories')
    .select('id, name, slug, icon, fee_type, fee_value, fee_flat_tiers, rate_min, rate_max')
    .eq('active', true)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ categories: data })
}
