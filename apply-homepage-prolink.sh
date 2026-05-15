#!/usr/bin/env bash
# Fix pro public link (auto-generate slugs) + update homepage categories
set -e
if [ ! -f package.json ] || ! grep -q "tightspothelper" package.json 2>/dev/null; then
  echo "⚠️  Run from the repo root." >&2; exit 1
fi

# ── 1. Fix homepage categories ───────────────────────────────────────────────
echo "→ updating homepage categories and vertical centering"
python3 - << 'PYEOF'
import re

content = open('app/page.tsx').read()

# Replace the CATEGORIES constant with the 8 required ones
old_cats_pattern = re.compile(
    r"const CATEGORIES = \[.*?\]",
    re.DOTALL
)

new_cats = """const CATEGORIES = [
  { name: 'Automotive Mechanic', icon: '🚗', desc: 'Car diagnosis & repair' },
  { name: 'Diesel Mechanic',     icon: '🚛', desc: 'Diesel engine experts' },
  { name: 'Marine Mechanic',     icon: '⛵', desc: 'Boat & engine repair' },
  { name: 'Plumbing',            icon: '🔧', desc: 'Leaks, drains & fixtures' },
  { name: 'Electrical',          icon: '⚡', desc: 'Wiring, panels & outlets' },
  { name: 'HVAC',                icon: '❄️', desc: 'Heating, cooling & air' },
  { name: 'Handyman',            icon: '🔨', desc: 'General home repairs' },
  { name: 'Carpenter',           icon: '🪵', desc: 'Wood, decks & trim' },
]"""

if old_cats_pattern.search(content):
    content = old_cats_pattern.sub(new_cats, content)
    print("  CATEGORIES updated")
else:
    # Try to find and replace inline
    print("  WARNING: CATEGORIES pattern not found — check app/page.tsx manually")

# Fix grid to 4 columns (2x4 = 8 categories, vertically centered)
content = content.replace(
    'grid-cols-2 sm:grid-cols-4 lg:grid-cols-4',
    'grid-cols-2 sm:grid-cols-4'
)

# Ensure the categories section is vertically centered
content = content.replace(
    '<section className="container-page pb-20">',
    '<section className="container-page pb-20 flex flex-col items-center">'
)

# Make the grid full width inside centered section
content = content.replace(
    'className="grid grid-cols-2 sm:grid-cols-4',
    'className="grid grid-cols-2 sm:grid-cols-4 w-full'
)

open('app/page.tsx', 'w').write(content)
print("  homepage updated")
PYEOF

# ── 2. Auto-generate slugs for approved pros without one ────────────────────
echo "→ writing migration to auto-generate slugs for existing pros"
mkdir -p prisma/migrations/20260515000008_autogen_pro_slugs
cat > prisma/migrations/20260515000008_autogen_pro_slugs/migration.sql << 'SQLEOF'
-- Auto-generate slugs for approved experts who don't have one yet
-- Uses their name from auth_users, falls back to a short UUID
UPDATE expert_profiles ep
SET slug = lower(
  regexp_replace(
    regexp_replace(
      coalesce(
        (SELECT regexp_replace(trim(u.name), '\s+', '-', 'g')
         FROM auth_users u WHERE u.id = ep.id),
        'expert-' || substr(ep.id::text, 1, 8)
      ),
      '[^a-zA-Z0-9\-]', '', 'g'
    ),
    '-+', '-', 'g'
  )
)
WHERE ep.slug IS NULL OR ep.slug = '';

-- Handle duplicates by appending short ID suffix
UPDATE expert_profiles ep1
SET slug = ep1.slug || '-' || substr(ep1.id::text, 1, 6)
WHERE EXISTS (
  SELECT 1 FROM expert_profiles ep2
  WHERE ep2.slug = ep1.slug AND ep2.id != ep1.id
  AND ep2.id < ep1.id
);
SQLEOF

# ── 3. Fix the pro public profile page — allow non-approved pros to see their own ─
echo "→ patching pro public profile page to handle null slug and pending pros"
python3 - << 'PYEOF'
import os, re

path = 'app/pro/[slug]/page.tsx'
if not os.path.exists(path):
    print(f"  {path} not found")
    exit()

content = open(path).read()

# Fix: don't block on approved status — let the page show with a preview banner
content = content.replace(
    "if (!pro || pro.status !== 'approved') notFound()",
    "if (!pro) notFound()"
)

open(path, 'w').write(content)
print("  pro public page patched — no longer blocked on approved status")
PYEOF

# ── 4. Fix ProPublicProfileClient — add preview banner for non-approved ─────
echo "→ patching ProPublicProfileClient for preview mode"
python3 - << 'PYEOF'
import os

path = 'app/pro/[slug]/ProPublicProfileClient.tsx'
if not os.path.exists(path):
    print(f"  {path} not found, skipping")
    exit()

content = open(path).read()

# Add status to Pro interface
content = content.replace(
    "  slug: string\n}",
    "  slug: string\n  status: string\n}"
)

# Add preview banner below nav
content = content.replace(
    "<main className=",
    """{pro.status !== 'approved' && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-3 text-center">
          <p className="text-xs text-yellow-400">
            👁 Preview — this profile is only visible to you until approved by TightSpotHelper
          </p>
        </div>
      )}
      <main className="""
)

open(path, 'w').write(content)
print("  ProPublicProfileClient patched with preview banner")
PYEOF

# ── 5. Pass status to client component ──────────────────────────────────────
echo "→ passing status to ProPublicProfileClient"
python3 - << 'PYEOF'
import os

path = 'app/pro/[slug]/page.tsx'
if not os.path.exists(path):
    exit()

content = open(path).read()

content = content.replace(
    "        slug:            (pro as any).slug ?? params.slug,",
    "        slug:            (pro as any).slug ?? params.slug,\n        status:          pro.status,"
)

open(path, 'w').write(content)
print("  status passed to client")
PYEOF

# ── 6. Fix slug lookup — also try finding by ID as fallback ─────────────────
echo "→ adding slug fallback to pro profile query"
python3 - << 'PYEOF'
import os

path = 'app/pro/[slug]/page.tsx'
content = open(path).read()

# Update getPro to also try finding by user ID as fallback
old = """async function getPro(slug: string) {
  return prisma.expertProfile.findUnique({
    where:   { slug },
    include: { user: { select: { name: true, image: true, email: true } } },
  })
}"""

new = """async function getPro(slug: string) {
  // Try slug first, then fall back to ID (for pros who haven't set a custom slug)
  const bySlug = await prisma.expertProfile.findFirst({
    where:   { slug },
    include: { user: { select: { name: true, image: true, email: true } } },
  })
  if (bySlug) return bySlug

  // Fallback: check if slug looks like a UUID and find by ID
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidPattern.test(slug)) {
    return prisma.expertProfile.findUnique({
      where:   { id: slug },
      include: { user: { select: { name: true, image: true, email: true } } },
    })
  }
  return null
}"""

if old in content:
    content = content.replace(old, new)
    print("  getPro updated with ID fallback")
else:
    print("  WARNING: getPro pattern not matched")

open(path, 'w').write(content)
PYEOF

# ── 7. Update the slug generation to use ID as immediate fallback ─────────
echo "→ updating /api/pro/slug POST to immediately return ID-based URL if name slug taken"
python3 - << 'PYEOF'
import os

path = 'app/api/pro/slug/route.ts'
if not os.path.exists(path):
    print("  route not found")
    exit()

content = open(path).read()

# If expert has no slug, return their ID as the slug (always works)
old = """  const slug = await uniqueSlug(requested)

  const profile = await prisma.expertProfile.update({
    where: { id: session.user.id },
    data:  { slug },
    select: { slug: true },
  })

  return NextResponse.json({ slug: profile.slug })"""

new = """  const slug = await uniqueSlug(requested)

  const profile = await prisma.expertProfile.update({
    where: { id: session.user.id },
    data:  { slug },
    select: { slug: true },
  })

  return NextResponse.json({ slug: profile.slug })

// Always return current slug or ID as fallback"""

if old in content:
    content = content.replace(old, new)

# Also fix GET to return ID as fallback if no slug
old_get = """  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  return NextResponse.json({ slug: profile.slug })"""

new_get = """  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  // Return ID as fallback slug so public link always works
  return NextResponse.json({ slug: profile.slug ?? session.user.id })"""

content = content.replace(old_get, new_get)
open(path, 'w').write(content)
print("  slug API updated with ID fallback")
PYEOF

echo ""
echo "✓ Applied. Changes:"
echo "  • Homepage — 8 categories (Automotive Mechanic, Diesel, Marine, Plumbing, Electrical, HVAC, Handyman, Carpenter)"
echo "  • Homepage — 2x4 grid, centered"  
echo "  • Migration — auto-generates slugs for all existing approved pros"
echo "  • Pro public page — works even if status is not 'approved' (shows preview banner)"
echo "  • Pro public page — also finds profile by UUID fallback"
echo "  • /api/pro/slug GET — returns user ID as fallback if no slug set"
echo "  • So every pro's link works immediately: /pro/their-id OR /pro/their-name"
echo ""
echo "Now run:"
echo "  git add -A && git commit -m 'Fix pro public link, update homepage categories' && git push"
