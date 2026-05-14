import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyCheckrWebhook, checkrPassed, type CheckrReport } from '@/lib/checkr'
import { sendApplicationResult } from '@/lib/resend'

export async function POST(req: NextRequest) {
  const payload   = await req.text()
  const signature = req.headers.get('x-checkr-signature') ?? ''

  if (!verifyCheckrWebhook(payload, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(payload)
  const admin = createAdminClient()

  // Only handle completed reports
  if (event.type !== 'report.completed') {
    return NextResponse.json({ received: true })
  }

  const report: CheckrReport = event.data.object
  const passed = checkrPassed(report)

  // Find expert by Checkr report ID
  const { data: expert } = await admin
    .from('expert_profiles')
    .select('id, checkr_candidate_id')
    .eq('checkr_report_id', report.id)
    .single()

  if (!expert) {
    console.error('No expert found for Checkr report:', report.id)
    return NextResponse.json({ received: true })
  }

  // Update background check result
  await admin
    .from('expert_profiles')
    .update({
      background_check_passed: passed,
      // Auto-approve if passed; leave at pending for admin to manually approve if not
      status: passed ? 'approved' : 'pending',
    })
    .eq('id', expert.id)

  // Notify expert via email
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', expert.id)
    .single()

  // Get email from auth.users via view
  const { data: userEmail } = await admin
    .from('user_emails' as any)
    .select('email')
    .eq('id', expert.id)
    .single()

  if (userEmail?.email && profile?.full_name) {
    await sendApplicationResult(userEmail.email, {
      name:     profile.full_name,
      approved: passed,
      reason:   passed ? undefined : 'Background check did not meet our requirements.',
    }).catch(console.error)
  }

  console.log(`Checkr report ${report.id}: ${passed ? 'PASSED' : 'FAILED'} for expert ${expert.id}`)
  return NextResponse.json({ received: true })
}
