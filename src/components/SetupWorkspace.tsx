import { useEffect, useState } from 'react'
import type { Apartment, Cleaner } from '#/lib/types'
import {
  normalizeCleanerColorHex,
  THEME_CLEANER_COLORS,
  isThemeCleanerColor,
} from '#/lib/cleaner-colors'

interface PlaceSuggestion {
  label: string
  latitude: number
  longitude: number
}

function extractCountryCodeFromLocale(locale: string) {
  const match = locale.trim().match(/[-_]([A-Za-z]{2})$/)
  return match?.[1]?.toLocaleLowerCase() ?? null
}

function getPreferredCountryCode() {
  if (typeof navigator === 'undefined') {
    return 'za'
  }

  const localeCandidates = [navigator.language, ...(navigator.languages ?? [])].filter(Boolean)

  for (const locale of localeCandidates) {
    const countryCode = extractCountryCodeFromLocale(locale)
    if (countryCode) {
      return countryCode
    }
  }

  return 'za'
}

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

async function getJson<TPayload>(url: string): Promise<TPayload> {
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: {
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Request failed')
  }

  return (await response.json()) as TPayload
}

export function SetupWorkspace({
  apartments,
  cleaners,
  busyKey,
  error,
  setBusyKey,
  setError,
  onDone,
}: {
  apartments: Apartment[]
  cleaners: Cleaner[]
  busyKey: string | null
  error: string | null
  setBusyKey: (value: string | null) => void
  setError: (value: string | null) => void
  onDone: () => Promise<void>
}) {
  const [apartmentName, setApartmentName] = useState('')
  const [address, setAddress] = useState('')
  const [preferredCountryCode] = useState(getPreferredCountryCode)
  const [addressCoordinates, setAddressCoordinates] = useState<{
    latitude: number
    longitude: number
  } | null>(null)
  const [addressSuggestions, setAddressSuggestions] = useState<PlaceSuggestion[]>([])
  const [isAddressSuggestionsOpen, setIsAddressSuggestionsOpen] = useState(false)
  const [isAddressSuggestionsLoading, setIsAddressSuggestionsLoading] = useState(false)
  const [bookingIcalUrl, setBookingIcalUrl] = useState('')
  const [airbnbIcalUrl, setAirbnbIcalUrl] = useState('')
  const [cleanerName, setCleanerName] = useState('')
  const [cleanerColorHex, setCleanerColorHex] = useState(THEME_CLEANER_COLORS[0]?.hex ?? '#7ea8f8')
  const [localCleaners, setLocalCleaners] = useState(cleaners)
  const [editingCleanerId, setEditingCleanerId] = useState<string | null>(null)
  const [editingCleanerName, setEditingCleanerName] = useState('')
  const [activeTool, setActiveTool] = useState<'home' | 'cleaner' | null>(null)
  const toolOptions: Array<{
    value: 'home' | 'cleaner'
    label: string
  }> = [
    { value: 'home', label: 'Add a home' },
    { value: 'cleaner', label: 'Add a cleaner' },
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

  useEffect(() => {
    setLocalCleaners(cleaners)
  }, [cleaners])

  useEffect(() => {
    const trimmedAddress = address.trim()
    const shouldQuerySuggestions = trimmedAddress.length >= 3 && activeTool === 'home'

    if (!shouldQuerySuggestions) {
      setAddressSuggestions([])
      setIsAddressSuggestionsOpen(false)
      setIsAddressSuggestionsLoading(false)
      return
    }

    const controller = new AbortController()
    setIsAddressSuggestionsLoading(true)
    const debounceTimer = window.setTimeout(() => {
      const autocompleteQuery = new URLSearchParams({
        q: trimmedAddress,
        country: preferredCountryCode,
      })

      void getJson<{ suggestions?: PlaceSuggestion[] }>(
        `/api/places/autocomplete?${autocompleteQuery.toString()}`,
      )
        .then((payload) => {
          if (controller.signal.aborted) {
            return
          }

          const suggestions = payload.suggestions ?? []
          setAddressSuggestions(suggestions)
          setIsAddressSuggestionsOpen(suggestions.length > 0)
        })
        .catch(() => {
          if (controller.signal.aborted) {
            return
          }

          setAddressSuggestions([])
          setIsAddressSuggestionsOpen(false)
          setError('Address lookup is unavailable right now. You can still type the full address.')
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsAddressSuggestionsLoading(false)
          }
        })
    }, 260)

    return () => {
      controller.abort()
      window.clearTimeout(debounceTimer)
    }
  }, [address, activeTool, preferredCountryCode])

  async function runOptimisticCleanerAction(
    key: string,
    optimisticUpdate: () => void,
    rollback: () => void,
    action: () => Promise<void>,
  ) {
    setBusyKey(key)
    setError(null)
    optimisticUpdate()

    try {
      await action()
    } catch (actionError) {
      rollback()
      setError(actionError instanceof Error ? actionError.message : 'Something went wrong')
    } finally {
      setBusyKey(null)
    }
  }

  const normalizedCleanerNames = new Set(
    localCleaners.map((cleaner) => cleaner.name.trim().toLocaleLowerCase()),
  )
  const trimmedCleanerName = cleanerName.trim()
  const cleanerAlreadyExists =
    trimmedCleanerName.length > 0 &&
    normalizedCleanerNames.has(trimmedCleanerName.toLocaleLowerCase())
  const cleanerNameTooShort = trimmedCleanerName.length > 0 && trimmedCleanerName.length < 2
  const normalizedUsedCleanerColors = new Set(
    localCleaners
      .map((cleaner) => normalizeCleanerColorHex(cleaner.colorHex))
      .filter((value): value is string => Boolean(value)),
  )
  const fallbackCleanerColor =
    THEME_CLEANER_COLORS.find(
      (color) => !normalizedUsedCleanerColors.has(color.hex.toLocaleLowerCase()),
    )?.hex ?? THEME_CLEANER_COLORS[0]?.hex ?? '#7fc8f8'
  const selectedCleanerColor = isThemeCleanerColor(cleanerColorHex)
    ? cleanerColorHex
    : fallbackCleanerColor
  const canSubmitCleaner =
    busyKey !== 'add-cleaner' &&
    trimmedCleanerName.length >= 2 &&
    !cleanerAlreadyExists
  const editingCleanerNameTrimmed = editingCleanerName.trim()
  const editingCleanerNameTooShort =
    editingCleanerNameTrimmed.length > 0 && editingCleanerNameTrimmed.length < 2
  const editingCleanerNameAlreadyExists =
    editingCleanerNameTrimmed.length > 0 &&
    localCleaners.some(
      (cleaner) =>
        cleaner.id !== editingCleanerId &&
        cleaner.name.trim().toLocaleLowerCase() === editingCleanerNameTrimmed.toLocaleLowerCase(),
    )
  const shouldShowAddressSuggestions =
    activeTool === 'home' &&
    isAddressSuggestionsOpen &&
    address.trim().length >= 3 &&
    addressSuggestions.length > 0

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
                    address,
                    bookingIcalUrl,
                    airbnbIcalUrl,
                    latitude: addressCoordinates?.latitude,
                    longitude: addressCoordinates?.longitude,
                  })
                  setApartmentName('')
                  setAddress('')
                  setAddressCoordinates(null)
                  setAddressSuggestions([])
                  setIsAddressSuggestionsOpen(false)
                  setBookingIcalUrl('')
                  setAirbnbIcalUrl('')
                })
              }}
            >
              <div className="space-y-1">
                <h2 className="section-title">Add a home</h2>
                <p className="text-sm leading-6 text-[var(--ink-soft)]">
                  Enter the listing and address. We will pin the home location automatically.
                </p>
              </div>
              <input className="field" placeholder="Listing name" value={apartmentName} onChange={(event) => setApartmentName(event.target.value)} required />
              <div className="address-field-wrap">
                <input
                  className="field"
                  placeholder="Street address"
                  value={address}
                  onChange={(event) => {
                    const nextAddress = event.target.value
                    setAddress(nextAddress)
                    setIsAddressSuggestionsOpen(true)
                    const matchedSuggestion = addressSuggestions.find(
                      (suggestion) => suggestion.label === nextAddress,
                    )
                    setAddressCoordinates(
                      matchedSuggestion
                        ? {
                            latitude: matchedSuggestion.latitude,
                            longitude: matchedSuggestion.longitude,
                          }
                        : null,
                    )
                  }}
                  autoComplete="off"
                  required
                />
                {shouldShowAddressSuggestions ? (
                  <div className="address-suggestions" role="listbox" aria-label="Address suggestions">
                    {addressSuggestions.map((suggestion) => (
                      <button
                        key={`${suggestion.label}-${suggestion.latitude}-${suggestion.longitude}`}
                        type="button"
                        className="address-suggestion-item"
                        onClick={() => {
                          setAddress(suggestion.label)
                          setAddressCoordinates({
                            latitude: suggestion.latitude,
                            longitude: suggestion.longitude,
                          })
                          setIsAddressSuggestionsOpen(false)
                        }}
                      >
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {isAddressSuggestionsLoading ? (
                <p className="text-xs text-[var(--ink-soft)]">Finding matching addresses...</p>
              ) : null}
              {!isAddressSuggestionsLoading && addressSuggestions.length > 0 ? (
                <p className="text-xs text-[var(--ink-soft)]">Select a suggested address to save exact coordinates.</p>
              ) : null}
              <input
                className="field"
                placeholder="Booking.com iCal link (optional)"
                value={bookingIcalUrl}
                onChange={(event) => setBookingIcalUrl(event.target.value)}
              />
              <input
                className="field"
                placeholder="Airbnb iCal link (optional)"
                value={airbnbIcalUrl}
                onChange={(event) => setAirbnbIcalUrl(event.target.value)}
              />
              <button type="submit" className="action-secondary" disabled={busyKey === 'add-apartment'}>
                {busyKey === 'add-apartment' ? 'Finding location...' : 'Add home'}
              </button>

              <div className="home-list-wrap">
                <p className="section-title">Your homes</p>
                {apartments.length ? (
                  <div className="home-list-grid">
                    {apartments.map((apartment) => {
                      const deleteKey = `delete-apartment-${apartment.id}`
                      const isDeleting = busyKey === deleteKey

                      return (
                        <article key={apartment.id} className="home-card">
                          <div>
                            <p className="home-card-name">{apartment.colloquialName ?? apartment.name}</p>
                            <p className="home-card-address">{apartment.address}</p>
                            {apartment.bookingIcalUrl || apartment.airbnbIcalUrl ? (
                              <div className="space-y-1">
                                {apartment.bookingIcalUrl ? (
                                  <a
                                    href={apartment.bookingIcalUrl}
                                    className="home-card-link"
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Booking.com iCal
                                  </a>
                                ) : null}
                                {apartment.airbnbIcalUrl ? (
                                  <a
                                    href={apartment.airbnbIcalUrl}
                                    className="home-card-link"
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Airbnb iCal
                                  </a>
                                ) : null}
                              </div>
                            ) : (
                              <p className="home-card-muted">No booking feeds connected</p>
                            )}
                          </div>
                          <button
                            type="button"
                            className="action-ghost home-delete-button"
                            disabled={isDeleting}
                            onClick={() => {
                              const confirmed = window.confirm(
                                `Delete ${apartment.colloquialName ?? apartment.name}? This removes its related bookings and schedule items.`,
                              )

                              if (!confirmed) {
                                return
                              }

                              void runAction(deleteKey, async () => {
                                await postJson(`/api/setup/apartments/${apartment.id}/delete`)
                              })
                            }}
                          >
                            {isDeleting ? 'Deleting...' : 'Delete home'}
                          </button>
                        </article>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-[var(--ink-soft)]">No homes added yet.</p>
                )}
              </div>
            </form>
          ) : null}

          {activeTool === 'cleaner' ? (
            <form
              className="fold-panel space-y-3"
              onSubmit={(event) => {
                event.preventDefault()

                if (trimmedCleanerName.length < 2) {
                  setError('Cleaner name must be at least 2 characters long')
                  return
                }

                if (cleanerAlreadyExists) {
                  setError('That cleaner already exists')
                  return
                }

                if (!isThemeCleanerColor(selectedCleanerColor)) {
                  setError('Choose one of the suggested theme colors')
                  return
                }

                void runAction('add-cleaner', async () => {
                  await postJson('/api/setup/cleaners', {
                    name: trimmedCleanerName,
                    colorHex: selectedCleanerColor,
                  })
                  setCleanerName('')
                  setCleanerColorHex(fallbackCleanerColor)
                })
              }}
            >
              <div className="space-y-1">
                <h2 className="section-title">Add a cleaner</h2>
                <p className="text-sm leading-6 text-[var(--ink-soft)]">
                  Add each teammate once. Pick a color to spot their assignments faster.
                </p>
              </div>

              <input
                className="field"
                placeholder="Cleaner name"
                value={cleanerName}
                onChange={(event) => setCleanerName(event.target.value)}
                required
                minLength={2}
              />

              <div className="space-y-2">
                <p className="section-title">Choose a color</p>
                <div className="theme-color-grid" role="radiogroup" aria-label="Cleaner color">
                  {THEME_CLEANER_COLORS.map((color) => {
                    const isSelected = selectedCleanerColor.toLocaleLowerCase() === color.hex.toLocaleLowerCase()

                    return (
                      <button
                        key={color.hex}
                        type="button"
                        className={`theme-color-swatch ${isSelected ? 'is-selected' : ''}`}
                        style={{ backgroundColor: color.hex }}
                        onClick={() => setCleanerColorHex(color.hex)}
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={color.label}
                        title={color.label}
                      />
                    )
                  })}
                </div>
              </div>

              {cleanerNameTooShort ? (
                <p className="text-xs text-[var(--accent-deep)]">Use at least 2 characters.</p>
              ) : null}
              {cleanerAlreadyExists ? (
                <p className="text-xs text-[var(--accent-deep)]">That cleaner already exists.</p>
              ) : null}

              <button type="submit" className="action-secondary" disabled={!canSubmitCleaner}>
                {busyKey === 'add-cleaner' ? 'Saving...' : 'Add cleaner'}
              </button>

              <div className="home-list-wrap">
                <p className="section-title">Current cleaners</p>
                {localCleaners.length ? (
                  <div className="home-list-grid">
                    {localCleaners.map((cleaner) => {
                      const isEditing = editingCleanerId === cleaner.id
                      const isUpdating = busyKey === `update-cleaner-${cleaner.id}`
                      const isDeleting = busyKey === `delete-cleaner-${cleaner.id}`

                      return (
                        <article
                          key={cleaner.id}
                          className={`home-card cleaner-card ${isEditing ? 'is-editing' : ''}`}
                        >
                          <div className="cleaner-entry-main">
                            <span className="cleaner-chip">
                              <span
                                className="cleaner-dot"
                                style={{ backgroundColor: cleaner.colorHex ?? '#7ea8f8' }}
                                aria-hidden="true"
                              />
                              {cleaner.name}
                            </span>

                            {isEditing ? (
                              <div className="cleaner-edit-wrap">
                                <input
                                  className="field cleaner-edit-input"
                                  value={editingCleanerName}
                                  onChange={(event) => setEditingCleanerName(event.target.value)}
                                  minLength={2}
                                  required
                                  autoFocus
                                />
                                {editingCleanerNameTooShort ? (
                                  <p className="text-xs text-[var(--accent-deep)]">Use at least 2 characters.</p>
                                ) : null}
                                {editingCleanerNameAlreadyExists ? (
                                  <p className="text-xs text-[var(--accent-deep)]">That cleaner already exists.</p>
                                ) : null}
                              </div>
                            ) : null}
                          </div>

                          <div className={`cleaner-entry-actions ${isEditing ? 'is-editing' : ''}`}>
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  className="cleaner-action-button cleaner-action-save"
                                  disabled={
                                    isUpdating ||
                                    editingCleanerNameTrimmed.length < 2 ||
                                    editingCleanerNameAlreadyExists
                                  }
                                  onClick={() => {
                                    if (
                                      editingCleanerNameTrimmed.length < 2 ||
                                      editingCleanerNameAlreadyExists
                                    ) {
                                      return
                                    }

                                    const previousCleaners = localCleaners.map((item) => ({ ...item }))
                                    const nextName = editingCleanerNameTrimmed

                                    void runOptimisticCleanerAction(
                                      `update-cleaner-${cleaner.id}`,
                                      () => {
                                        setLocalCleaners((current) =>
                                          current.map((item) =>
                                            item.id === cleaner.id ? { ...item, name: nextName } : item,
                                          ),
                                        )
                                        setEditingCleanerId(null)
                                        setEditingCleanerName('')
                                      },
                                      () => {
                                        setLocalCleaners(previousCleaners)
                                        setEditingCleanerId(cleaner.id)
                                        setEditingCleanerName(nextName)
                                      },
                                      async () => {
                                        await postJson(`/api/setup/cleaners/${cleaner.id}/update`, {
                                          name: nextName,
                                        })
                                      },
                                    )
                                  }}
                                >
                                  {isUpdating ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  type="button"
                                  className="cleaner-action-button cleaner-action-cancel"
                                  disabled={isUpdating}
                                  onClick={() => {
                                    setEditingCleanerId(null)
                                    setEditingCleanerName('')
                                  }}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="cleaner-action-button cleaner-action-edit"
                                  disabled={isDeleting}
                                  onClick={() => {
                                    setEditingCleanerId(cleaner.id)
                                    setEditingCleanerName(cleaner.name)
                                  }}
                                >
                                  Edit name
                                </button>
                                <button
                                  type="button"
                                  className="cleaner-action-button cleaner-action-delete"
                                  disabled={isDeleting}
                                  onClick={() => {
                                    const confirmed = window.confirm(
                                      `Delete ${cleaner.name}? Existing assignments will be kept but unassigned.`,
                                    )

                                    if (!confirmed) {
                                      return
                                    }

                                    const previousCleaners = localCleaners.map((item) => ({ ...item }))

                                    void runOptimisticCleanerAction(
                                      `delete-cleaner-${cleaner.id}`,
                                      () => {
                                        setLocalCleaners((current) =>
                                          current.filter((item) => item.id !== cleaner.id),
                                        )

                                        if (editingCleanerId === cleaner.id) {
                                          setEditingCleanerId(null)
                                          setEditingCleanerName('')
                                        }
                                      },
                                      () => {
                                        setLocalCleaners(previousCleaners)
                                      },
                                      async () => {
                                        await postJson(`/api/setup/cleaners/${cleaner.id}/delete`)
                                      },
                                    )
                                  }}
                                >
                                  {isDeleting ? 'Deleting...' : 'Delete'}
                                </button>
                              </>
                            )}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-[var(--ink-soft)]">No cleaners added yet.</p>
                )}
              </div>
            </form>
          ) : null}

        </div>
      </article>

      {error ? (
        <section className="error-banner">{error}</section>
      ) : null}
    </section>
  )
}
