import { fetchPlaceAutocompleteSuggestions } from '../services/places'
import type { ApiApp } from '../types'

export function registerPlacesRoutes(app: ApiApp) {
  app.get('/api/places/autocomplete', async (c) => {
    const queryText = (c.req.query('q') || '').trim()

    if (queryText.length < 3) {
      return c.json({ suggestions: [] })
    }

    const suggestions = await fetchPlaceAutocompleteSuggestions(queryText, 5)

    return c.json({ suggestions })
  })
}