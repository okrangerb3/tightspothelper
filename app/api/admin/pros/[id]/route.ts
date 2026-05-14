import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendApplicationResult } from '@/lib/resend'
import { initiateBackgroundCheck } from '@/lib/checkr'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const admin    = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { status, rejection_reason } = await req.json()

  const { error } = await admin.from('expert_profiles').update({
    status,
    rejection_reason: rejection_reason ?? null,
    reviewed_by:      user.id,
    reviewed_at:      new Date().toISOString(),
  }).eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch expert info for notifications
  const [
    { data: profile },
    { data: emailRow },
    { data: expert },
  ] = await Promise.all([
    admin.from('profiles').select('full_name').eq('id', params.id).single(),
    admin.from('user_emails' as any).select('email').eq('id', params.id).single(),
    admin.from('expert_profiles').select('checkr_candidate_id').eq('id', params.id).single(),
  ])

  const email = (emailRow as any)?.email
  const name  = (profile as any)?.full_name ?? 'Expert'

  // Send email notification
  if (email) {
    sendApplicationResult(email, {
      name,
      approved:  status === 'approved',
      reason:    rejection_reason,
    }).catch(e => console.error('Application email failed:', e))
  }

  // If approving and no background check yet, initiate Checkr check
  if (status === 'approved' && !expert?.checkr_candidate_id && email && process.env.CHECKR_API_KEY) {
    const nameParts = name.split(' ')
    initiateBackgroundCheck({
      email,
      firstName: nameParts[0] ?? name,
      lastName:  nameParts.slice(1).join(' ') || 'Unknown',
    }).then(async ({ candidateId, reportId }) => {
      await admin.from('expert_profiles').update({
        checkr_candidate_id: candidateId,
        checkr_report_id:    reportId,
      }).eq('id', params.id)
    }).catch(e => console.error('Checkr initiation failed:', e))
  }

  return NextResponse.json({ ok: true })
}
