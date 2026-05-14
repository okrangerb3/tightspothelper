import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { deleteObject } from '@/lib/r2'

export async function POST(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // Find all expired free recordings not yet deleted
  const { data: expired, error } = await supabase
    .from('recordings')
    .select('id, r2_key, session_id')
    .eq('plan', 'free')
    .lte('expires_at', now)
    .is('deleted_at', null)

  if (error) {
    console.error('Cron query error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let deleted = 0
  let failed  = 0

  for (const rec of expired ?? []) {
    try {
      // Delete from R2 (admin copy is never deleted by cron)
      await deleteObject(rec.r2_key)

      // Soft-delete in DB
      await supabase
        .from('recordings')
        .update({ deleted_at: now })
        .eq('id', rec.id)

      deleted++
    } catch (err) {
      console.error(`Failed to delete recording ${rec.id}:`, err)
      failed++
    }
  }

  console.log(`Recording expiry cron: ${deleted} deleted, ${failed} failed`)
  return NextResponse.json({ deleted, failed, total: expired?.length ?? 0 })
}
