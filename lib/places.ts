const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY!

interface PlaceResult {
  name:          string
  address:       string
  phone:         string | null
  lat:           number
  lng:           number
  rating:        number | null
  placeId:       string
  types:         string[]
  businessStatus: string
}

// Map our category names to Google Places search terms
const CATEGORY_SEARCH_TERMS: Record<string, string[]> = {
  'Automotive Mechanic': ['auto mechanic', 'auto repair shop', 'car mechanic'],
  'Diesel Mechanic':     ['diesel mechanic', 'diesel repair', 'truck repair'],
  'Marine Mechanic':     ['marine mechanic', 'boat repair', 'marine engine repair'],
  'Plumbing':            ['plumber', 'plumbing company', 'plumbing repair'],
  'Electrical':          ['electrician', 'electrical contractor', 'electrical repair'],
  'HVAC':                ['hvac contractor', 'air conditioning repair', 'heating repair'],
  'Handyman':            ['handyman service', 'home repair service'],
  'Carpenter':           ['carpenter', 'carpentry service', 'woodworking'],
}

export async function findLocalPros(params: {
  categoryName: string
  lat: number
  lng: number
  radiusMeters?: number
}): Promise<PlaceResult[]> {
  const terms = CATEGORY_SEARCH_TERMS[params.categoryName] ?? [params.categoryName.toLowerCase()]
  const radius = params.radiusMeters ?? 40000 // 25 miles default
  const results: PlaceResult[] = []
  const seenIds = new Set<string>()

  for (const term of terms) {
    try {
      const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json')
      url.searchParams.set('key', GOOGLE_PLACES_KEY)
      url.searchParams.set('location', `${params.lat},${params.lng}`)
      url.searchParams.set('radius', String(radius))
      url.searchParams.set('keyword', term)
      url.searchParams.set('type', 'establishment')

      const res = await fetch(url.toString())
      const data = await res.json()

      if (data.status !== 'OK') continue

      for (const place of data.results ?? []) {
        if (seenIds.has(place.place_id)) continue
        if (place.business_status !== 'OPERATIONAL') continue
        seenIds.add(place.place_id)

        // Get phone number via Place Details
        const detailUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json')
        detailUrl.searchParams.set('key', GOOGLE_PLACES_KEY)
        detailUrl.searchParams.set('place_id', place.place_id)
        detailUrl.searchParams.set('fields', 'formatted_phone_number,international_phone_number')

        const detailRes = await fetch(detailUrl.toString())
        const detailData = await detailRes.json()
        const phone = detailData.result?.international_phone_number
          ?? detailData.result?.formatted_phone_number
          ?? null

        results.push({
          name:           place.name,
          address:        place.vicinity ?? '',
          phone,
          lat:            place.geometry?.location?.lat ?? 0,
          lng:            place.geometry?.location?.lng ?? 0,
          rating:         place.rating ?? null,
          placeId:        place.place_id,
          types:          place.types ?? [],
          businessStatus: place.business_status,
        })
      }
    } catch (e) {
      console.error(`Places search failed for "${term}":`, e)
    }

    if (results.length >= 20) break // Cap at 20 leads per search
  }

  return results
}
