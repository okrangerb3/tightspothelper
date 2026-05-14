import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { initiateBackgroundCheck } from '@/lib/checkr'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const admin    = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!process.env.CHECKR_API_KEY)
    return NextResponse.json({ error: 'Checkr not configured' }, { status: 503 })

  const [
    { data: profile },
    { data: emailRow },
    { data: expert },
  ] = await Promise.all([
    admin.from('profiles').select('full_name').eq('id', params.id).single(),
    admin.from('user_emails' as any).select('email').eq('id', params.id).single(),
    admin.from('expert_profiles').select('checkr_candidate_id, status').eq('id', params.id).single(),
  ])

  if (!expert) return NextResponse.json({ error: 'Expert not found' }, { status: 404 })

  const email = (emailRow as any)?.email
  const name  = (profile as any)?.full_name ?? 'Expert'

  if (!email) return NextResponse.json({ error: 'Expert has no email on record' }, { status: 400 })

  try {
    const nameParts = name.split(' ')
    const { candidateId, reportId } = await initiateBackgroundCheck({
      email,
      firstName: nameParts[0] ?? name,
      lastName:  nameParts.slice(1).join(' ') || 'Unknown',
    })

    await admin.from('expert_profiles').update({
      checkr_candidate_id: candidateId,
      checkr_report_id:    reportId,
      background_check_passed: null,
    }).eq('id', params.id)

    return NextResponse.json({ ok: true, candidateId, reportId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Checkr initiation failed' }, { status: 500 })
  }
}
