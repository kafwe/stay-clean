import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Apartment, Cleaner } from '#/lib/types'
import {
  normalizeCleanerColorHex,
  THEME_CLEANER_COLORS,
  isThemeCleanerColor,
} from '#/lib/cleaner-colors'
import {
  apartmentSchema,
  cleanerSchema,
  cleanerUpdateSchema,
} from '#/lib/validation'
import type { z } from 'zod'

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
  const [preferredCountryCode] = useState(getPreferredCountryCode)
  const [addressCoordinates, setAddressCoordinates] = useState<{
    latitude: number
    longitude: number
  } | null>(null)
  const [addressSuggestions, setAddressSuggestions] = useState<PlaceSuggestion[]>([])
  const [isAddressSuggestionsOpen, setIsAddressSuggestionsOpen] = useState(false)
  const [isAddressSuggestionsLoading, setIsAddressSuggestionsLoading] = useState(false)
  const [localCleaners, setLocalCleaners] = useState(cleaners)
  const [editingCleanerId, setEditingCleanerId] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<'home' | 'cleaner' | null>(null)

  const homeForm = useForm<z.input<typeof apartmentSchema>>({
    resolver: zodResolver(apartmentSchema),
    defaultValues: {
      name: '',
      address: '',
      bookingIcalUrl: '',
      airbnbIcalUrl: '',
    },
  })
  const cleanerForm = useForm<z.input<typeof cleanerSchema>>({
    resolver: zodResolver(cleanerSchema),
    defaultValues: {
      name: '',
      colorHex: THEME_CLEANER_COLORS[0]?.hex ?? '#7ea8f8',
    },
  })
  const editCleanerForm = useForm<z.input<typeof cleanerUpdateSchema>>({
    resolver: zodResolver(cleanerUpdateSchema),
    defaultValues: {
      name: '',
    },
  })

  const {
    register: registerHome,
    handleSubmit: handleHomeSubmit,
    setValue: setHomeValue,
    clearErrors: clearHomeErrors,
    reset: resetHomeForm,
    formState: { errors: homeErrors },
  } = homeForm
  const {
    register: registerCleaner,
    handleSubmit: handleCleanerSubmit,
    setValue: setCleanerValue,
    setError: setCleanerFormError,
    clearErrors: clearCleanerErrors,
    reset: resetCleanerForm,
    formState: { errors: cleanerErrors },
  } = cleanerForm
  const {
    register: registerEditCleaner,
    handleSubmit: handleEditCleanerSubmit,
    reset: resetEditCleanerForm,
    setError: setEditCleanerFormError,
    clearErrors: clearEditCleanerErrors,
    formState: { errors: editCleanerErrors },
  } = editCleanerForm

  const address = homeForm.watch('address') ?? ''
  const cleanerName = cleanerForm.watch('name') ?? ''
  const cleanerColorHex = cleanerForm.watch('colorHex') ?? (THEME_CLEANER_COLORS[0]?.hex ?? '#7ea8f8')
  const editingCleanerName = editCleanerForm.watch('name') ?? ''

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
    const shouldQuerySuggestions =
      trimmedAddress.length >= 3 && activeTool === 'home' && addressCoordinates === null

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
  }, [address, activeTool, addressCoordinates, preferredCountryCode, setError])

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
  const addCleanerNameError =
    cleanerAlreadyExists
      ? 'That cleaner already exists.'
      : cleanerErrors.name?.message
  const editingCleanerNameError =
    editingCleanerNameAlreadyExists
      ? 'That cleaner already exists.'
      : editCleanerErrors.name?.message
  const activeHomeForm = activeTool === 'home'
  const activeCleanerForm = activeTool === 'cleaner'

  return (
    <section className="content-stack">
      <article className="ledger-panel rounded-[1.75rem] p-5 panel-soft">
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
          <div className="setup-summary-grid">
            <article className="fold-panel setup-summary-panel">
              <div className="setup-summary-head">
                <div>
                  <p className="section-title">Homes in the plan</p>
                  <p className="setup-summary-copy">
                    Review addresses and feed links before adding another home.
                  </p>
                </div>
                <button
                  type="button"
                  className={activeHomeForm ? 'action-ghost' : 'action-secondary'}
                  onClick={() => setActiveTool(activeHomeForm ? null : 'home')}
                >
                  {activeHomeForm ? 'Hide form' : 'Add a home'}
                </button>
              </div>

              {apartments.length ? (
                <div className="home-list-grid setup-summary-list">
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
            </article>

            <article className="fold-panel setup-summary-panel">
              <div className="setup-summary-head">
                <div>
                  <p className="section-title">Current cleaners</p>
                  <p className="setup-summary-copy">
                    Keep the active team visible here so edits feel lower risk.
                  </p>
                </div>
                <button
                  type="button"
                  className={activeCleanerForm ? 'action-ghost' : 'action-secondary'}
                  onClick={() => setActiveTool(activeCleanerForm ? null : 'cleaner')}
                >
                  {activeCleanerForm ? 'Hide form' : 'Add a cleaner'}
                </button>
              </div>

              {localCleaners.length ? (
                <div className="home-list-grid setup-summary-list">
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
                              {editingCleanerNameError ? (
                                <p className="text-xs text-[var(--accent-deep)]">{editingCleanerNameError}</p>
                              ) : null}
                              <input
                                className="field cleaner-edit-input"
                                {...registerEditCleaner('name', {
                                  onChange: () => {
                                    if (editCleanerErrors.name) {
                                      clearEditCleanerErrors('name')
                                    }
                                  },
                                })}
                                autoFocus
                                aria-invalid={editingCleanerNameError ? 'true' : undefined}
                              />
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
                                  void handleEditCleanerSubmit((values) => {
                                    if (editingCleanerNameAlreadyExists) {
                                      setEditCleanerFormError('name', {
                                        type: 'manual',
                                        message: 'That cleaner already exists.',
                                      })
                                      return
                                    }

                                    const previousCleaners = localCleaners.map((item) => ({ ...item }))
                                    const nextName = values.name

                                    void runOptimisticCleanerAction(
                                      `update-cleaner-${cleaner.id}`,
                                      () => {
                                        setLocalCleaners((current) =>
                                          current.map((item) =>
                                            item.id === cleaner.id ? { ...item, name: nextName } : item,
                                          ),
                                        )
                                        setEditingCleanerId(null)
                                        resetEditCleanerForm({ name: '' })
                                      },
                                      () => {
                                        setLocalCleaners(previousCleaners)
                                        setEditingCleanerId(cleaner.id)
                                        resetEditCleanerForm({ name: nextName })
                                      },
                                      async () => {
                                        await postJson(`/api/setup/cleaners/${cleaner.id}/update`, {
                                          name: nextName,
                                        })
                                      },
                                    )
                                  })()
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
                                  resetEditCleanerForm({ name: '' })
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
                                  resetEditCleanerForm({ name: cleaner.name })
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
                                        resetEditCleanerForm({ name: '' })
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
            </article>
          </div>

          {activeHomeForm ? (
            <form
              className="fold-panel space-y-3"
              noValidate
              onSubmit={handleHomeSubmit((values) => {
                void runAction('add-apartment', async () => {
                  await postJson('/api/setup/apartments', {
                    ...values,
                    latitude: addressCoordinates?.latitude,
                    longitude: addressCoordinates?.longitude,
                  })
                  resetHomeForm()
                  setAddressCoordinates(null)
                  setAddressSuggestions([])
                  setIsAddressSuggestionsOpen(false)
                })
              })}
            >
              <div className="space-y-1">
                <h2 className="section-title">Add a home</h2>
                <p className="text-sm leading-6 text-[var(--ink-soft)]">
                  Enter the listing and address. We will pin the home location automatically.
                </p>
              </div>
              {homeErrors.name ? (
                <p className="text-xs text-[var(--accent-deep)]">{homeErrors.name.message}</p>
              ) : null}
              <input
                className="field"
                placeholder="Listing name"
                {...registerHome('name')}
                aria-invalid={homeErrors.name ? 'true' : undefined}
              />
              <div className="address-field-wrap">
                {homeErrors.address ? (
                  <p className="mb-2 text-xs text-[var(--accent-deep)]">{homeErrors.address.message}</p>
                ) : null}
                <input
                  className="field"
                  placeholder="Street address"
                  {...registerHome('address')}
                  onChange={(event) => {
                    const nextAddress = event.target.value
                    setHomeValue('address', nextAddress, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
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
                    clearHomeErrors('address')
                  }}
                  autoComplete="off"
                  aria-invalid={homeErrors.address ? 'true' : undefined}
                />
                {shouldShowAddressSuggestions ? (
                  <div className="address-suggestions" role="listbox" aria-label="Address suggestions">
                    {addressSuggestions.map((suggestion) => (
                      <button
                        key={`${suggestion.label}-${suggestion.latitude}-${suggestion.longitude}`}
                        type="button"
                        className="address-suggestion-item"
                        onClick={() => {
                          setHomeValue('address', suggestion.label, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                          setAddressCoordinates({
                            latitude: suggestion.latitude,
                            longitude: suggestion.longitude,
                          })
                          setIsAddressSuggestionsOpen(false)
                          clearHomeErrors('address')
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
              {!isAddressSuggestionsLoading && addressSuggestions.length > 0 && !addressCoordinates ? (
                <p className="text-xs text-[var(--ink-soft)]">Select a suggested address to save exact coordinates.</p>
              ) : null}
              {homeErrors.bookingIcalUrl ? (
                <p className="text-xs text-[var(--accent-deep)]">{homeErrors.bookingIcalUrl.message}</p>
              ) : null}
              <input
                className="field"
                placeholder="Booking.com iCal link (optional)"
                {...registerHome('bookingIcalUrl')}
                aria-invalid={homeErrors.bookingIcalUrl ? 'true' : undefined}
              />
              {homeErrors.airbnbIcalUrl ? (
                <p className="text-xs text-[var(--accent-deep)]">{homeErrors.airbnbIcalUrl.message}</p>
              ) : null}
              <input
                className="field"
                placeholder="Airbnb iCal link (optional)"
                {...registerHome('airbnbIcalUrl')}
                aria-invalid={homeErrors.airbnbIcalUrl ? 'true' : undefined}
              />
              <button type="submit" className="action-secondary" disabled={busyKey === 'add-apartment'}>
                {busyKey === 'add-apartment' ? 'Finding location...' : 'Add home'}
              </button>
            </form>
          ) : null}

          {activeCleanerForm ? (
            <form
              className="fold-panel space-y-3"
              noValidate
              onSubmit={handleCleanerSubmit((values) => {
                if (cleanerAlreadyExists) {
                  setCleanerFormError('name', {
                    type: 'manual',
                    message: 'That cleaner already exists.',
                  })
                  return
                }

                if (!isThemeCleanerColor(selectedCleanerColor)) {
                  setCleanerFormError('colorHex', {
                    type: 'manual',
                    message: 'Choose one of the suggested theme colors',
                  })
                  return
                }

                void runAction('add-cleaner', async () => {
                  await postJson('/api/setup/cleaners', {
                    ...values,
                    colorHex: selectedCleanerColor,
                  })
                  resetCleanerForm({
                    name: '',
                    colorHex: fallbackCleanerColor,
                  })
                })
              })}
            >
              <div className="space-y-1">
                <h2 className="section-title">Add a cleaner</h2>
                <p className="text-sm leading-6 text-[var(--ink-soft)]">
                  Add each teammate once. Pick a color to spot their assignments faster.
                </p>
              </div>
              {addCleanerNameError ? (
                <p className="text-xs text-[var(--accent-deep)]">{addCleanerNameError}</p>
              ) : null}

              <input
                className="field"
                placeholder="Cleaner name"
                {...registerCleaner('name', {
                  onChange: () => {
                    if (cleanerErrors.name) {
                      clearCleanerErrors('name')
                    }
                  },
                })}
                aria-invalid={addCleanerNameError ? 'true' : undefined}
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
                        onClick={() => {
                          setCleanerValue('colorHex', color.hex, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                          clearCleanerErrors('colorHex')
                        }}
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={color.label}
                        title={color.label}
                      />
                    )
                  })}
                </div>
              </div>

              {cleanerErrors.colorHex ? (
                <p className="text-xs text-[var(--accent-deep)]">{cleanerErrors.colorHex.message}</p>
              ) : null}

              <button type="submit" className="action-secondary" disabled={!canSubmitCleaner}>
                {busyKey === 'add-cleaner' ? 'Saving...' : 'Add cleaner'}
              </button>
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
