import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import type { Metadata } from 'next'
import ProPublicProfileClient from './ProPublicProfileClient'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tightspothelper.com'

interface Props { params: { slug: string } }

async function getPro(slug: string) {
  return prisma.expertProfile.findUnique({
    where:   { slug },
    include: { user: { select: { name: true, image: true, email: true } } },
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const pro = await getPro(params.slug)
  if (!pro) return { title: 'Expert not found' }
  const name = pro.user.name ?? 'Expert'
  return {
    title:       `${name} — TightSpotHelper Expert`,
    description: (pro as any).publicBio ?? pro.bio ?? `Book a remote session with ${name} on TightSpotHelper.`,
    openGraph: {
      title:       `${name} — TightSpotHelper`,
      description: (pro as any).publicBio ?? pro.bio ?? '',
      url:         `${BASE_URL}/pro/${params.slug}`,
      type:        'profile',
    },
  }
}

export default async function ProPublicProfile({ params }: Props) {
  const pro = await getPro(params.slug)
  if (!pro || pro.status !== 'approved') notFound()

  const categories = pro.categoryIds.length
    ? await prisma.category.findMany({
        where:  { id: { in: pro.categoryIds } },
        select: { name: true, slug: true, icon: true },
      })
    : []

  return (
    <ProPublicProfileClient
      pro={{
        id:              pro.id,
        name:            pro.user.name ?? 'Expert',
        image:           pro.user.image ?? null,
        bio:             (pro as any).publicBio ?? pro.bio ?? null,
        headline:        (pro as any).headline ?? null,
        hourlyRate:      Number(pro.hourlyRate ?? 0),
        ratingAvg:       Number(pro.ratingAvg ?? 0),
        ratingCount:     pro.ratingCount,
        yearsExperience: pro.yearsExperience ?? null,
        available:       pro.available,
        certifications:  pro.certifications,
        specialties:     (pro as any).specialties ?? [],
        emergencyAvailable: (pro as any).emergencyAvailable ?? false,
        emergencyRate:   Number((pro as any).emergencyRate ?? 0),
        slug:            (pro as any).slug ?? params.slug,
      }}
      categories={categories}
      baseUrl={BASE_URL}
    />
  )
}
