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
