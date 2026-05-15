import { MetadataRoute } from 'next'
import { prisma } from '@/lib/db'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tightspothelper.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL,              lastModified: new Date(), changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE_URL}/login`,   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/signup`,  lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  ]

  // Category pages
  let categoryPages: MetadataRoute.Sitemap = []
  try {
    const categories = await prisma.category.findMany({
      where: { active: true },
      select: { slug: true, updatedAt: true },
    })
    categoryPages = categories.map(c => ({
      url:              `${BASE_URL}/services/${c.slug}`,
      lastModified:     c.updatedAt,
      changeFrequency:  'weekly' as const,
      priority:         0.8,
    }))
  } catch {}

  // Pro public profiles
  let proPages: MetadataRoute.Sitemap = []
  try {
    const pros = await prisma.expertProfile.findMany({
      where: { status: 'approved', slug: { not: null } },
      select: { slug: true, updatedAt: true },
    })
    proPages = pros
      .filter(p => p.slug)
      .map(p => ({
        url:             `${BASE_URL}/pro/${p.slug}`,
        lastModified:    p.updatedAt,
        changeFrequency: 'weekly' as const,
        priority:        0.7,
      }))
  } catch {}

  return [...staticPages, ...categoryPages, ...proPages]
}
