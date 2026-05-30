import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { findLocalPros } from '@/lib/places'
import { sendSMS, buildInviteSMS } from '@/lib/twilio'
import crypto from 'crypto'

const MAX_SMS_PER_JOB = 10
const TARGET_REGISTERED_PROS = 3

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { categoryId, categoryName, lat, lng, city } = await req.json()

  if (!categoryId || !categoryName || !lat || !lng) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Check how many approved pros already exist in this category
  const existingPros = await prisma.expertProfile.count({
    where: {
      status:      'approved',
      available:   true,
      categoryIds: { has: categoryId },
    },
  })

  if (existingPros >= TARGET_REGISTERED_PROS) {
    return NextResponse.json({
      ok: true,
      message: `${existingPros} pros already available in this category`,
      prosFound: existingPros,
      smssSent: 0,
    })
  }

  // Find local businesses via Google Places
  const places = await findLocalPros({ categoryName, lat, lng })

  if (places.length === 0) {
    return NextResponse.json({
      ok: true,
      message: 'No local businesses found in this area',
      prosFound: 0,
      smssSent: 0,
    })
  }

  let smsSent = 0
  const leads: any[] = []

  for (const place of places) {
    if (smsSent >= MAX_SMS_PER_JOB) break

    // Skip if no phone number
    if (!place.phone) continue

    // Normalize phone
    const normalizedPhone = place.phone.replace(/[^+\d]/g, '')
    if (normalizedPhone.length < 10) continue

    // Check if we've already contacted this business
    const existing = await (prisma as any).proLead.findFirst({
      where: {
        OR: [
          { googlePlaceId: place.placeId },
          { phone: normalizedPhone },
        ],
      },
    })

    if (existing) {
      leads.push({ ...existing, skipped: 'already_contacted' })
      continue
    }

    // Generate invite code
    const inviteCode = crypto.randomBytes(6).toString('hex')

    // Store lead in database
    const lead = await (prisma as any).proLead.create({
      data: {
        businessName:   place.name,
        phone:          normalizedPhone,
        address:        place.address,
        lat:            place.lat,
        lng:            place.lng,
        googlePlaceId:  place.placeId,
        googleRating:   place.rating,
        categoryId,
        categoryName,
        inviteCode,
        source:         'google_places',
        status:         'discovered',
        discoveredById: session.user.id,
      },
    })

    // Send SMS via Twilio
    try {
      const smsBody = buildInviteSMS({
        businessName: place.name,
        categoryName,
        customerCity: city ?? 'your area',
        inviteCode,
      })

      const twilioResult = await sendSMS(normalizedPhone, smsBody)

      // Record outreach
      await (prisma as any).proOutreach.create({
        data: {
          proLeadId:    lead.id,
          channel:      'sms',
          twilioSid:    twilioResult.sid,
          status:       'sent',
          messageBody:  smsBody,
        },
      })

      // Update lead status
      await (prisma as any).proLead.update({
        where: { id: lead.id },
        data:  { status: 'contacted', lastContactedAt: new Date() },
      })

      smsSent++
      leads.push({ ...lead, smsStatus: 'sent' })
    } catch (smsErr: any) {
      console.error(`SMS failed for ${place.name}:`, smsErr.message)

      await (prisma as any).proOutreach.create({
        data: {
          proLeadId:   lead.id,
          channel:     'sms',
          status:      'failed',
          error:       smsErr.message,
          messageBody: '',
        },
      })

      leads.push({ ...lead, smsStatus: 'failed', error: smsErr.message })
    }
  }

  return NextResponse.json({
    ok: true,
    message: `Found ${places.length} businesses, sent ${smsSent} SMS invites`,
    placesFound: places.length,
    smsSent,
    leadsCreated: leads.length,
    existingPros,
    targetPros: TARGET_REGISTERED_PROS,
  })
}

// GET — admin views all leads
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if ((session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const leads = await (prisma as any).proLead.findMany({
    orderBy: { createdAt: 'desc' },
    include: { outreach: true },
    take: 100,
  })

  return NextResponse.json({ leads })
}
