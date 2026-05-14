// ============================================================
// TightSpotHelper — Prisma seed data (development only)
// Run: npm run db:seed
// ============================================================

import { PrismaClient } from '@prisma/client'
import { randomBytes, randomUUID, scrypt } from 'crypto'

const prisma = new PrismaClient()

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')

  const key = await new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      64,
      {
        N: 16384,
        r: 16,
        p: 1,
        maxmem: 128 * 16384 * 16 * 2,
      },
      (error, derivedKey) => {
        if (error) reject(error)
        else resolve(derivedKey)
      },
    )
  })

  return `${salt}:${key.toString('hex')}`
}

async function createDemoUser(params: { email: string; password: string; name: string; role?: 'customer' | 'expert' }) {
  const { email, password, name, role = 'customer' } = params
  const userId = randomUUID()
  const hashedPassword = await hashPassword(password)

  const user = await prisma.authUser.upsert({
    where: { email },
    update: {
      name,
      role,
      emailVerified: true,
    },
    create: {
      id: userId,
      name,
      email,
      emailVerified: true,
      role,
    },
  })

  await prisma.authAccount.upsert({
    where: { id: `${user.id}-credential` },
    update: {
      password: hashedPassword,
    },
    create: {
      id: `${user.id}-credential`,
      accountId: user.id,
      providerId: 'credential',
      userId: user.id,
      password: hashedPassword,
    },
  })

  return user
}

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
    {
      name: 'Automotive',    slug: 'automotive',    icon: 'ti-car',
      feeType: 'percentage' as const, feeValue: 0.20, rateMin: 50, rateMax: 250,
      description: 'Diagnostics, repairs, and maintenance',
    },
    {
      name: 'Marine',        slug: 'marine',        icon: 'ti-ship',
      feeType: 'percentage' as const, feeValue: 0.20, rateMin: 60, rateMax: 300,
      description: 'Boats, engines, and dockside repairs',
    },
  ]

  const categoryIds: Record<string, string> = {}

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i]
    const savedCategory = await prisma.category.upsert({
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
    categoryIds[cat.slug] = savedCategory.id
    console.log(`  ✓ ${cat.name}`)
  }

  console.log('\nSeeding demo users...')

  // Demo customer
  const customer = await createDemoUser({
    email: 'customer@demo.test',
    password: 'password123',
    name: 'Jamie Homeowner',
    role: 'customer',
  })

  // Demo expert
  const expert = await createDemoUser({
    email: 'expert@demo.test',
    password: 'password123',
    name: 'Alex Plumber',
    role: 'expert',
  })

  await prisma.expertProfile.upsert({
    where: { id: expert.id },
    update: {
      status: 'approved',
      bio: 'Licensed master plumber with 12 years of residential & commercial experience.',
      yearsExperience: 12,
      certifications: ['Master Plumber License CA-MP-44821'],
      hourlyRate: 120,
      available: true,
      stripeConnectOnboarded: false,
      backgroundCheckPassed: true,
    },
    create: {
      id: expert.id,
      status: 'approved',
      bio: 'Licensed master plumber with 12 years of residential & commercial experience.',
      yearsExperience: 12,
      certifications: ['Master Plumber License CA-MP-44821'],
      hourlyRate: 120,
      categoryIds: [categoryIds.plumbing].filter(Boolean),
      available: true,
      stripeConnectOnboarded: false,
      backgroundCheckPassed: true,
    },
  })
  console.log('  ✓ Demo expert (expert@demo.test / password123)')
  console.log('  ✓ Demo customer (customer@demo.test / password123)')

  console.log('\n✅ Seed complete')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
