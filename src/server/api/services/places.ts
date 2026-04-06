import { env } from 'cloudflare:workers'

export interface AddressSuggestion {
  label: string
  latitude: number
  longitude: number
}

interface NominatimAddress {
  house_number?: string
  road?: string
  suburb?: string
  neighbourhood?: string
  city?: string
  town?: string
  village?: string
  postcode?: string
}

interface NominatimSearchResult {
  display_name?: string
  lat?: string
  lon?: string
  address?: NominatimAddress
}

interface GoogleAddressComponent {
  long_name?: string
  short_name?: string
  types?: string[]
}

function normalizeStreetNumber(value: string | undefined | null) {
  return (value || '').trim().toLocaleLowerCase()
}

async function geocodeAddressWithNominatim(
  address: string,
): Promise<{ latitude: number; longitude: number }> {
  const query = new URLSearchParams({
    q: address,
    format: 'jsonv2',
    limit: '1',
  })

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${query.toString()}`, {
    headers: {
      accept: 'application/json',
      'accept-language': 'en',
      'user-agent': 'stay-clean/1.0',
    },
  })

  if (!response.ok) {
    throw new Error('We could not find this address right now. Please try again.')
  }

  const payload = (await response.json().catch(() => null)) as
    | Array<{ lat?: string; lon?: string }>
    | null

  const firstHit = payload?.[0]
  const latitude = Number(firstHit?.lat)
  const longitude = Number(firstHit?.lon)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('We could not place that address. Try a more specific address.')
  }

  return { latitude, longitude }
}

async function geocodeAddressWithGoogle(
  address: string,
  googleApiKey: string,
): Promise<{ latitude: number; longitude: number }> {
  const query = new URLSearchParams({
    address,
    components: 'country:ZA',
    key: googleApiKey,
  })

  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${query.toString()}`)

  if (!response.ok) {
    throw new Error('We could not find this address right now. Please try again.')
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        status?: string
        results?: Array<{
          geometry?: {
            location?: {
              lat?: number
              lng?: number
            }
          }
        }>
      }
    | null

  const firstHit = payload?.results?.[0]
  const latitude = Number(firstHit?.geometry?.location?.lat)
  const longitude = Number(firstHit?.geometry?.location?.lng)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('We could not place that address. Try a more specific address.')
  }

  return { latitude, longitude }
}

export async function geocodeAddress(
  address: string,
): Promise<{ latitude: number; longitude: number }> {
  const googleApiKey = (env.GOOGLE_PLACES_API_KEY || '').trim()

  if (googleApiKey) {
    try {
      return await geocodeAddressWithGoogle(address, googleApiKey)
    } catch {
      return geocodeAddressWithNominatim(address)
    }
  }

  return geocodeAddressWithNominatim(address)
}

function getGoogleAddressPart(
  components: GoogleAddressComponent[] | undefined,
  type: string,
) {
  return components?.find((component) => component.types?.includes(type))?.long_name
}

function buildSimplifiedGoogleLabel(
  formattedAddress: string,
  components: GoogleAddressComponent[] | undefined,
) {
  const streetNumber = getGoogleAddressPart(components, 'street_number')
  const route = getGoogleAddressPart(components, 'route')
  const suburb =
    getGoogleAddressPart(components, 'sublocality_level_1') ||
    getGoogleAddressPart(components, 'sublocality') ||
    getGoogleAddressPart(components, 'neighborhood')
  const city =
    getGoogleAddressPart(components, 'locality') ||
    getGoogleAddressPart(components, 'postal_town') ||
    getGoogleAddressPart(components, 'administrative_area_level_2')
  const postcode = getGoogleAddressPart(components, 'postal_code')

  const street = [streetNumber, route].filter(Boolean).join(' ').trim()
  const parts = [street, suburb, city, postcode]
    .map((part) => (part || '').trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return formattedAddress
  }

  return Array.from(new Set(parts)).join(', ')
}

function buildSimplifiedSuggestionLabel(result: NominatimSearchResult) {
  const address = result.address
  const fallback = (result.display_name || '').trim()

  if (!address) {
    return fallback
  }

  const street = [address.house_number, address.road].filter(Boolean).join(' ').trim()
  const locality =
    address.suburb || address.neighbourhood || address.city || address.town || address.village
  const city = address.city || address.town || address.village

  const parts = [street, locality, city, address.postcode]
    .map((part) => (part || '').trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return fallback
  }

  return Array.from(new Set(parts)).join(', ')
}

function scoreSuggestionMatch(queryText: string, result: NominatimSearchResult) {
  const normalizedQuery = queryText.toLocaleLowerCase()
  const queryNumberMatch = normalizedQuery.match(/\b\d+[a-z]?\b/i)
  const queryStreetNumber = queryNumberMatch?.[0] ?? null
  const houseNumber = result.address?.house_number?.toLocaleLowerCase() ?? ''
  const hasHouseNumber = houseNumber.length > 0
  const hasRoad = Boolean(result.address?.road)
  const hasPostcode = Boolean(result.address?.postcode)
  const exactStreetNumberMatch =
    Boolean(queryStreetNumber) && houseNumber === queryStreetNumber?.toLocaleLowerCase()

  let score = 0

  if (exactStreetNumberMatch) {
    score += 7
  }

  if (hasHouseNumber) {
    score += 4
  }

  if (hasRoad) {
    score += 2
  }

  if (hasPostcode) {
    score += 1
  }

  return score
}

async function fetchAddressSuggestions(
  queryText: string,
  limit: number,
): Promise<AddressSuggestion[]> {
  const candidateLimit = Math.max(limit * 3, 12)
  const query = new URLSearchParams({
    q: queryText,
    format: 'jsonv2',
    limit: String(candidateLimit),
    addressdetails: '1',
    countrycodes: 'za',
  })

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${query.toString()}`, {
    headers: {
      accept: 'application/json',
      'accept-language': 'en',
      'user-agent': 'stay-clean/1.0',
    },
  })

  if (!response.ok) {
    throw new Error('Address suggestions are unavailable right now')
  }

  const payload = (await response.json().catch(() => null)) as Array<NominatimSearchResult> | null

  const scoredMatches = (payload ?? [])
    .map((item) => ({
      item,
      score: scoreSuggestionMatch(queryText, item),
    }))
    .sort((left, right) => right.score - left.score)

  return scoredMatches
    .map(({ item }) => item)
    .map((item) => {
      const latitude = Number(item.lat)
      const longitude = Number(item.lon)

      if (!item.display_name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null
      }

      return {
        label: buildSimplifiedSuggestionLabel(item),
        latitude,
        longitude,
      }
    })
    .filter((item): item is AddressSuggestion => Boolean(item))
    .slice(0, limit)
}

async function fetchAddressSuggestionsWithGoogle(
  queryText: string,
  limit: number,
  googleApiKey: string,
): Promise<AddressSuggestion[]> {
  const autocompleteQuery = new URLSearchParams({
    input: queryText,
    components: 'country:za',
    types: 'address',
    key: googleApiKey,
  })

  const autocompleteResponse = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${autocompleteQuery.toString()}`,
  )

  if (!autocompleteResponse.ok) {
    throw new Error('Address suggestions are unavailable right now')
  }

  const autocompletePayload = (await autocompleteResponse.json().catch(() => null)) as
    | {
        predictions?: Array<{
          place_id?: string
        }>
      }
    | null

  const placeIds = (autocompletePayload?.predictions ?? [])
    .map((prediction) => prediction.place_id)
    .filter((placeId): placeId is string => Boolean(placeId))
    .slice(0, Math.max(limit * 2, 8))

  if (placeIds.length === 0) {
    return []
  }

  const detailResults = await Promise.all(
    placeIds.map(async (placeId) => {
      const detailQuery = new URLSearchParams({
        place_id: placeId,
        fields: 'formatted_address,geometry/location,address_component',
        key: googleApiKey,
      })

      const detailResponse = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?${detailQuery.toString()}`,
      )

      if (!detailResponse.ok) {
        return null
      }

      const detailPayload = (await detailResponse.json().catch(() => null)) as
        | {
            result?: {
              formatted_address?: string
              geometry?: {
                location?: {
                  lat?: number
                  lng?: number
                }
              }
              address_components?: GoogleAddressComponent[]
            }
          }
        | null

      const formattedAddress = (detailPayload?.result?.formatted_address || '').trim()
      const latitude = Number(detailPayload?.result?.geometry?.location?.lat)
      const longitude = Number(detailPayload?.result?.geometry?.location?.lng)

      if (!formattedAddress || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null
      }

      const streetNumber = normalizeStreetNumber(
        getGoogleAddressPart(detailPayload?.result?.address_components, 'street_number'),
      )
      const queryStreetNumber = normalizeStreetNumber(queryText.match(/\b\d+[a-z]?\b/i)?.[0] ?? null)
      const exactStreetNumberMatch =
        queryStreetNumber.length > 0 && streetNumber === queryStreetNumber

      return {
        label: buildSimplifiedGoogleLabel(
          formattedAddress,
          detailPayload?.result?.address_components,
        ),
        latitude,
        longitude,
        score: exactStreetNumberMatch ? 10 : streetNumber.length > 0 ? 6 : 0,
      }
    }),
  )

  const dedupeKeys = new Set<string>()
  return detailResults
    .filter(
      (
        result,
      ): result is { label: string; latitude: number; longitude: number; score: number } =>
        Boolean(result),
    )
    .sort((left, right) => right.score - left.score)
    .filter((result) => {
      const dedupeKey = `${result.label.toLocaleLowerCase()}|${result.latitude}|${result.longitude}`

      if (dedupeKeys.has(dedupeKey)) {
        return false
      }

      dedupeKeys.add(dedupeKey)
      return true
    })
    .slice(0, limit)
    .map((result) => ({
      label: result.label,
      latitude: result.latitude,
      longitude: result.longitude,
    }))
}

export async function fetchPlaceAutocompleteSuggestions(
  queryText: string,
  limit: number,
): Promise<AddressSuggestion[]> {
  const googleApiKey = (env.GOOGLE_PLACES_API_KEY || '').trim()
  let suggestions: AddressSuggestion[] = []

  if (googleApiKey) {
    try {
      suggestions = await fetchAddressSuggestionsWithGoogle(queryText, limit, googleApiKey)
    } catch {
      suggestions = []
    }
  }

  if (suggestions.length === 0) {
    suggestions = await fetchAddressSuggestions(queryText, limit)
  }

  return suggestions
}

export function inferBuildingId(address: string) {
  const primarySegment = address
    .split(',')
    .map((part) => part.trim())
    .find(Boolean)

  return (primarySegment || address).slice(0, 80)
}