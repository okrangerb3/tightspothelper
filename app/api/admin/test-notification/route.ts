import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-helpers'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.RESEND_FROM_EMAIL ?? 'noreply@tightspothelper.com'

export async function POST(req: NextRequest) {
  const { error } = await requireRole('admin')
  if (error) return error

  const { type, to } = await req.json()
  if (!to) return NextResponse.json({ error: 'Recipient email required' }, { status: 400 })

  const templates: Record<string, { subject: string; html: string }> = {
    verification: {
      subject: '✅ Test: Email verification',
      html: `<div style="background:#09090b;padding:40px;font-family:sans-serif;color:#fff;">
        <h2 style="color:#f97c0a;">TightSpotHelper</h2>
        <h3>Email Verification Test</h3>
        <p>This is a test of the email verification template.</p>
        <a href="#" style="background:#f97c0a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin:16px 0;">Verify Email →</a>
        <p style="color:#666;font-size:12px;">Sent at ${new Date().toISOString()}</p>
      </div>`,
    },
    booking_confirm: {
      subject: '✅ Test: Booking confirmation',
      html: `<div style="background:#09090b;padding:40px;font-family:sans-serif;color:#fff;">
        <h2 style="color:#f97c0a;">TightSpotHelper</h2>
        <h3>Booking Confirmation Test</h3>
        <p>Your session has been confirmed. Expert: <strong>Jane Smith</strong></p>
        <p>Duration: <strong>1 hour</strong> · Total: <strong>$78.75</strong></p>
        <p style="color:#666;font-size:12px;">Sent at ${new Date().toISOString()}</p>
      </div>`,
    },
    session_summary: {
      subject: '✅ Test: Session summary',
      html: `<div style="background:#09090b;padding:40px;font-family:sans-serif;color:#fff;">
        <h2 style="color:#f97c0a;">TightSpotHelper</h2>
        <h3>Session Summary Test</h3>
        <p>Your session has ended. Duration: <strong>47 minutes</strong></p>
        <p>Total charged: <strong>$61.69</strong></p>
        <p style="color:#666;font-size:12px;">Sent at ${new Date().toISOString()}</p>
      </div>`,
    },
    payout: {
      subject: '✅ Test: Payout released',
      html: `<div style="background:#09090b;padding:40px;font-family:sans-serif;color:#fff;">
        <h2 style="color:#f97c0a;">TightSpotHelper</h2>
        <h3>Payout Released Test</h3>
        <p>Your payout of <strong>$56.25</strong> has been sent to your Stripe account.</p>
        <p style="color:#666;font-size:12px;">Sent at ${new Date().toISOString()}</p>
      </div>`,
    },
    plain: {
      subject: '✅ Test: Plain email from TightSpotHelper',
      html: `<div style="background:#09090b;padding:40px;font-family:sans-serif;color:#fff;">
        <h2 style="color:#f97c0a;">TightSpotHelper</h2>
        <p>This is a plain test email to verify your Resend configuration is working correctly.</p>
        <p>From: <strong>${FROM}</strong></p>
        <p>API Key configured: <strong>${process.env.RESEND_API_KEY ? 'Yes (re_***)' : 'NO — NOT SET'}</strong></p>
        <p style="color:#666;font-size:12px;">Sent at ${new Date().toISOString()}</p>
      </div>`,
    },
  }

  const template = templates[type] ?? templates.plain

  try {
    const result = await resend.emails.send({
      from:    FROM,
      to:      [to],
      subject: template.subject,
      html:    template.html,
    })

    if (result.error) {
      return NextResponse.json({
        ok:    false,
        error: result.error.message,
        code:  result.error.name,
        debug: {
          apiKeySet:  !!process.env.RESEND_API_KEY,
          fromEmail:  FROM,
          toEmail:    to,
        },
      }, { status: 400 })
    }

    return NextResponse.json({
      ok:      true,
      emailId: result.data?.id,
      message: `Test email sent to ${to}`,
      debug: {
        apiKeySet: !!process.env.RESEND_API_KEY,
        fromEmail: FROM,
        toEmail:   to,
      },
    })
  } catch (err: any) {
    return NextResponse.json({
      ok:    false,
      error: err.message ?? 'Unknown error',
      debug: {
        apiKeySet: !!process.env.RESEND_API_KEY,
        fromEmail: FROM,
        toEmail:   to,
      },
    }, { status: 500 })
  }
}
