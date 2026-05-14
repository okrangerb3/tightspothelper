// ============================================================
// TightSpotHelper — Prisma seed data (development only)
// Run: npm run db:seed
// ============================================================

import { PrismaClient } from '@prisma/client'
import { auth } from '../lib/auth'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding categories...')

  const categories = [
    {
      name: 'Plumbing',    slug: 'plumbing',    icon: 'ti-droplet',
      feeType: 'percentage' as const, feeValue: 0.20, rateMin: 40, rateMax: 250,
      description: 'Pipes, drains, fixtures',
    },
    {
      name: 'Electrical',  slug: 'electrical',  icon: 'ti-bolt',
      feeType: 'percentage' as const, feeValue: 0.22, rateMin: 50, rateMax: 300,
      description: 'Wiring, panels, outlets',
    },
    {
      name: 'HVAC',        slug: 'hvac',        icon: 'ti-wind',
      feeType: 'percentage' as const, feeValue: 0.18, rateMin: 60, rateMax: 300,
      description: 'Heating, cooling, ventilation',
    },
    {
      name: 'Appliances',  slug: 'appliances',  icon: 'ti-tool',
      feeType: 'flat' as const,       feeValue: 0,    rateMin: 35, rateMax: 200,
      description: 'Washers, dryers, refrigerators',
      feeFlatTiers: { '15':4,'30':6,'45':8,'60':10,'75':12,'90':14,'105':16,'120':18 },
    },
    {
      name: 'Carpentry',   slug: 'carpentry',   icon: 'ti-hammer',
      feeType: 'flat' as const,       feeValue: 0,    rateMin: 30, rateMax: 175,
      description: 'Doors, trim, furniture assembly',
      feeFlatTiers: { '15':5,'30':8,'45':10,'60':12,'75':15,'90':18,'105':20,'120':22 },
    },
    {
      name: 'General handyman', slug: 'handyman', icon: 'ti-screwdriver',
      feeType: 'percentage' as const, feeValue: 0.15, rateMin: 25, rateMax: 150,
      description: 'Misc repairs and installs',
    },
  ]

  for (const [i, cat] of categories.entries()) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: {
        name:         cat.name,
        slug:         cat.slug,
        icon:         cat.icon,
        feeType:      cat.feeType,
        feeValue:     cat.feeValue,
        rateMin:      cat.rateMin,
        rateMax:      cat.rateMax,
        description:  cat.description,
        sortOrder:    i,
        feeFlatTiers: cat.feeFlatTiers ?? undefined,
      },
    })
    console.log(`  ✓ ${cat.name}`)
  }

  console.log('\nSeeding demo users...')

  // Demo customer
  const customer = await auth.api.createUser?.({
    body: { email: 'customer@demo.test', password: 'password123', name: 'Jamie Homeowner' },
  }).catch(() => null)

  // Demo expert
  const expert = await auth.api.createUser?.({
    body: { email: 'expert@demo.test', password: 'password123', name: 'Alex Plumber' },
  }).catch(() => null)

  if (expert) {
    await prisma.authUser.update({
      where: { email: 'expert@demo.test' },
      data:  { role: 'expert' },
    })
    const expertUser = await prisma.authUser.findUnique({ where: { email: 'expert@demo.test' } })
    if (expertUser) {
      await prisma.expertProfile.upsert({
        where:  { id: expertUser.id },
        update: {},
        create: {
          id:                    expertUser.id,
          status:                'approved',
          bio:                   'Licensed master plumber with 12 years of residential & commercial experience.',
          yearsExperience:       12,
          certifications:        ['Master Plumber License CA-MP-44821'],
          hourlyRate:            120,
          available:             true,
          stripeConnectOnboarded: false,
          backgroundCheckPassed:  true,
        },
      })
      console.log('  ✓ Demo expert (expert@demo.test / password123)')
    }
  }

  if (customer) {
    console.log('  ✓ Demo customer (customer@demo.test / password123)')
  }

  console.log('\n✅ Seed complete')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
