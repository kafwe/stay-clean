import { useState } from 'react'
import type { Apartment } from '#/lib/types'

async function postJson(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error ?? 'Request failed')
  }
}

export function SetupWorkspace({
  apartments,
  distanceMatrixPairs,
  apartmentsMissingCoordinates,
  busyKey,
  error,
  setBusyKey,
  setError,
  onDone,
}: {
  apartments: Apartment[]
  distanceMatrixPairs: number
  apartmentsMissingCoordinates: number
  busyKey: string | null
  error: string | null
  setBusyKey: (value: string | null) => void
  setError: (value: string | null) => void
  onDone: () => Promise<void>
}) {
  const [apartmentName, setApartmentName] = useState('')
  const [apartmentColloquialName, setApartmentColloquialName] = useState('')
  const [buildingId, setBuildingId] = useState('')
  const [address, setAddress] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [icalUrl, setIcalUrl] = useState('')
  const [cleanerName, setCleanerName] = useState('')
  const [locationApartmentId, setLocationApartmentId] = useState('')
  const [locationLatitude, setLocationLatitude] = useState('')
  const [locationLongitude, setLocationLongitude] = useState('')
  const [activeTool, setActiveTool] = useState<
    'home' | 'location' | 'cleaner' | 'travel' | null
  >(null)
  const toolOptions: Array<{
    value: 'home' | 'location' | 'cleaner' | 'travel'
    label: string
  }> = [
    { value: 'home', label: 'Add a home' },
    { value: 'location', label: 'Update a home location' },
    { value: 'cleaner', label: 'Add a cleaner' },
    { value: 'travel', label: 'Refresh travel times' },
  ]

  async function runAction(key: string, action: () => Promise<void>) {
    setBusyKey(key)
    setError(null)

    try {
      await action()
      await onDone()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Something went wrong')
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <section className="content-stack">
      <article className="ledger-panel rounded-[1.75rem] p-5">
        <div className="section-head">
          <div>
            <p className="eyebrow">Less-used setup tools</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">Homes and team</h2>
          </div>
          <p className="section-copy">
            These tools are here when the homes or cleaner list needs updating.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          <div className="tool-grid">
            {toolOptions.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`tool-tile ${activeTool === value ? 'is-active' : ''}`}
                onClick={() => setActiveTool(activeTool === value ? null : value)}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTool === 'home' ? (
            <form
              className="fold-panel space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                void runAction('add-apartment', async () => {
                  await postJson('/api/setup/apartments', {
                    name: apartmentName,
                    colloquialName: apartmentColloquialName,
                    buildingId,
                    address,
                    latitude: latitude ? Number(latitude) : null,
                    longitude: longitude ? Number(longitude) : null,
                    icalUrl,
                  })
                  setApartmentName('')
                  setApartmentColloquialName('')
                  setBuildingId('')
                  setAddress('')
                  setLatitude('')
                  setLongitude('')
                  setIcalUrl('')
                })
              }}
            >
              <h2 className="section-title">Add a home</h2>
              <input className="field" placeholder="Listing name" value={apartmentName} onChange={(event) => setApartmentName(event.target.value)} />
              <input className="field" placeholder="Everyday apartment name" value={apartmentColloquialName} onChange={(event) => setApartmentColloquialName(event.target.value)} />
              <input className="field" placeholder="Building name or ID" value={buildingId} onChange={(event) => setBuildingId(event.target.value)} />
              <input className="field" placeholder="Address" value={address} onChange={(event) => setAddress(event.target.value)} />
              <div className="grid gap-3 sm:grid-cols-2">
                <input type="number" step="any" className="field" placeholder="Latitude" value={latitude} onChange={(event) => setLatitude(event.target.value)} />
                <input type="number" step="any" className="field" placeholder="Longitude" value={longitude} onChange={(event) => setLongitude(event.target.value)} />
              </div>
              <input className="field" placeholder="Booking feed link (optional)" value={icalUrl} onChange={(event) => setIcalUrl(event.target.value)} />
              <button type="submit" className="action-secondary" disabled={busyKey === 'add-apartment'}>
                {busyKey === 'add-apartment' ? 'Saving...' : 'Add home'}
              </button>
            </form>
          ) : null}

          {activeTool === 'location' ? (
            <form
              className="fold-panel space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                void runAction('save-location', async () => {
                  await postJson(`/api/setup/apartments/${locationApartmentId}/location`, {
                    latitude: Number(locationLatitude),
                    longitude: Number(locationLongitude),
                  })
                  setLocationApartmentId('')
                  setLocationLatitude('')
                  setLocationLongitude('')
                })
              }}
            >
              <h2 className="section-title">Update home location</h2>
              <select className="field" value={locationApartmentId} onChange={(event) => setLocationApartmentId(event.target.value)}>
                <option value="">Choose apartment</option>
                {apartments.map((apartment) => (
                  <option key={apartment.id} value={apartment.id}>
                    {apartment.colloquialName ?? apartment.name}
                    {apartment.latitude !== null && apartment.longitude !== null ? ' • location saved' : ''}
                  </option>
                ))}
              </select>
              <div className="grid gap-3 sm:grid-cols-2">
                <input type="number" step="any" className="field" placeholder="Latitude" value={locationLatitude} onChange={(event) => setLocationLatitude(event.target.value)} />
                <input type="number" step="any" className="field" placeholder="Longitude" value={locationLongitude} onChange={(event) => setLocationLongitude(event.target.value)} />
              </div>
              <button type="submit" className="action-secondary" disabled={busyKey === 'save-location' || !locationApartmentId}>
                {busyKey === 'save-location' ? 'Saving...' : 'Save location'}
              </button>
            </form>
          ) : null}

          {activeTool === 'cleaner' ? (
            <form
              className="fold-panel space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                void runAction('add-cleaner', async () => {
                  await postJson('/api/setup/cleaners', { name: cleanerName })
                  setCleanerName('')
                })
              }}
            >
              <h2 className="section-title">Add a cleaner</h2>
              <input className="field" placeholder="Cleaner name" value={cleanerName} onChange={(event) => setCleanerName(event.target.value)} />
              <button type="submit" className="action-secondary" disabled={busyKey === 'add-cleaner'}>
                {busyKey === 'add-cleaner' ? 'Saving...' : 'Add cleaner'}
              </button>
            </form>
          ) : null}

          {activeTool === 'travel' ? (
            <div className="fold-panel space-y-3">
              <p className="text-sm leading-7 text-[var(--ink-soft)]">
                {distanceMatrixPairs} saved travel pairs. {apartmentsMissingCoordinates} home
                {apartmentsMissingCoordinates === 1 ? '' : 's'} still need a location.
              </p>
              <button
                type="button"
                className="action-secondary"
                disabled={busyKey === 'seed-distance'}
                onClick={() => {
                  void runAction('seed-distance', async () => {
                    await postJson('/api/setup/distance-matrix/seed')
                  })
                }}
              >
                {busyKey === 'seed-distance' ? 'Updating...' : 'Refresh travel times'}
              </button>
            </div>
          ) : null}
        </div>
      </article>

      {error ? (
        <section className="error-banner">{error}</section>
      ) : null}
    </section>
  )
}
