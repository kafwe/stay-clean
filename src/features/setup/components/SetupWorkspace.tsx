import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AddApartmentForm } from './setup-workspace/AddApartmentForm'
import { AddCleanerForm } from './setup-workspace/AddCleanerForm'
import { ApartmentListPanel } from './setup-workspace/ApartmentListPanel'
import { CleanerListPanel } from './setup-workspace/CleanerListPanel'
import { useDashboardActionMutation } from '#/lib/dashboard-query'
import type { PlaceSuggestion } from './setup-workspace/types'
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
    throw new Error(payload?.error ?? 'Something went wrong. Please try again.')
  }
}

function useDebouncedValue(value: string, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value)
    }, delayMs)

    return () => {
      window.clearTimeout(timer)
    }
  }, [value, delayMs])

  return debouncedValue
}

async function fetchPlaceSuggestions(address: string, countryCode: string): Promise<PlaceSuggestion[]> {
  const autocompleteQuery = new URLSearchParams({
    q: address,
    country: countryCode,
  })

  const response = await fetch(`/api/places/autocomplete?${autocompleteQuery.toString()}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Something went wrong. Please try again.')
  }

  const payload = (await response.json()) as { suggestions?: PlaceSuggestion[] }
  return payload.suggestions ?? []
}

export function SetupWorkspace({
  apartments = [],
  cleaners = [],
  weekSearch,
  busyKey,
  error,
  setBusyKey,
  setError,
}: {
  apartments?: Apartment[]
  cleaners?: Cleaner[]
  weekSearch?: string
  busyKey: string | null
  error: string | null
  setBusyKey: (value: string | null) => void
  setError: (value: string | null) => void
}) {
  const actionMutation = useDashboardActionMutation(weekSearch)
  const [preferredCountryCode] = useState(getPreferredCountryCode)
  const [addressCoordinates, setAddressCoordinates] = useState<{
    latitude: number
    longitude: number
  } | null>(null)
  const [isAddressSuggestionsOpen, setIsAddressSuggestionsOpen] = useState(false)
  const [localCleaners, setLocalCleaners] = useState<Cleaner[]>(cleaners)
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
      colorHex: THEME_CLEANER_COLORS[0]?.hex ?? '#7ea8f8',
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
    setValue: setEditCleanerValue,
    setError: setEditCleanerFormError,
    clearErrors: clearEditCleanerErrors,
    formState: { errors: editCleanerErrors },
  } = editCleanerForm

  const address = homeForm.watch('address') ?? ''
  const cleanerName = cleanerForm.watch('name') ?? ''
  const cleanerColorHex = cleanerForm.watch('colorHex') ?? (THEME_CLEANER_COLORS[0]?.hex ?? '#7ea8f8')
  const editingCleanerName = editCleanerForm.watch('name') ?? ''
  const editingCleanerColorHex = editCleanerForm.watch('colorHex') ?? (THEME_CLEANER_COLORS[0]?.hex ?? '#7ea8f8')
  const trimmedAddress = address.trim()
  const debouncedAddress = useDebouncedValue(trimmedAddress, 260)
  const shouldQuerySuggestions =
    trimmedAddress.length >= 3 &&
    activeTool === 'home' &&
    addressCoordinates === null
  const {
    data: addressSuggestions = [],
    isFetching: isAddressSuggestionsLoading,
    isError: hasAddressSuggestionsError,
    errorUpdatedAt: addressSuggestionsErrorUpdatedAt,
  } = useQuery({
    queryKey: ['places-autocomplete', preferredCountryCode, debouncedAddress],
    queryFn: () => fetchPlaceSuggestions(debouncedAddress, preferredCountryCode),
    enabled: shouldQuerySuggestions && debouncedAddress.length >= 3,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  })

  async function runAction(key: string, action: () => Promise<void>) {
    setBusyKey(key)
    setError(null)

    try {
      await actionMutation.mutateAsync(action)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Something went wrong. Please try again.')
    } finally {
      setBusyKey(null)
    }
  }

  useEffect(() => {
    setLocalCleaners(cleaners)
  }, [cleaners])

  useEffect(() => {
    if (
      !hasAddressSuggestionsError ||
      !shouldQuerySuggestions ||
      debouncedAddress !== trimmedAddress
    ) {
      return
    }

    setIsAddressSuggestionsOpen(false)
    setError('Address lookup is unavailable right now. You can still enter the full address.')
  }, [
    hasAddressSuggestionsError,
    shouldQuerySuggestions,
    debouncedAddress,
    trimmedAddress,
    addressSuggestionsErrorUpdatedAt,
    setError,
  ])

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
      await actionMutation.mutateAsync(action)
    } catch (actionError) {
      rollback()
      setError(actionError instanceof Error ? actionError.message : 'Something went wrong. Please try again.')
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
  const selectedEditingCleanerColor = isThemeCleanerColor(editingCleanerColorHex)
    ? editingCleanerColorHex
    : THEME_CLEANER_COLORS[0]?.hex ?? '#7ea8f8'
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
    trimmedAddress.length >= 3 &&
    debouncedAddress === trimmedAddress &&
    addressSuggestions.length > 0
  const addCleanerNameError =
    cleanerAlreadyExists
      ? 'That cleaner already exists.'
      : cleanerErrors.name?.message
  const editingCleanerNameError =
    editingCleanerNameAlreadyExists
      ? 'That cleaner already exists.'
      : editCleanerErrors.name?.message
  const editingCleanerColorError = editCleanerErrors.colorHex?.message
  const activeHomeForm = activeTool === 'home'
  const activeCleanerForm = activeTool === 'cleaner'
  const closeHomeForm = () => {
    setActiveTool(null)
    setIsAddressSuggestionsOpen(false)
  }
  const closeCleanerForm = () => {
    setActiveTool(null)
  }
  const editCleanerNameInputProps = registerEditCleaner('name', {
    onChange: () => {
      if (editCleanerErrors.name) {
        clearEditCleanerErrors('name')
      }
    },
  })

  function handleDeleteApartment(apartment: Apartment) {
    const confirmed = window.confirm(
      `Delete ${apartment.colloquialName ?? apartment.name}? This also removes related bookings and schedule items.`,
    )

    if (!confirmed) {
      return
    }

    void runAction(`delete-apartment-${apartment.id}`, async () => {
      await postJson(`/api/setup/apartments/${apartment.id}/delete`)
    })
  }

  function handleStartCleanerEdit(cleaner: Cleaner) {
    const cleanerColor = normalizeCleanerColorHex(cleaner.colorHex)

    setEditingCleanerId(cleaner.id)
    resetEditCleanerForm({
      name: cleaner.name,
      colorHex: cleanerColor && isThemeCleanerColor(cleanerColor)
        ? cleanerColor
        : THEME_CLEANER_COLORS[0]?.hex ?? '#7ea8f8',
    })
  }

  function handleCancelCleanerEdit() {
    setEditingCleanerId(null)
    resetEditCleanerForm({
      name: '',
      colorHex: THEME_CLEANER_COLORS[0]?.hex ?? '#7ea8f8',
    })
  }

  function handleSaveCleanerEdit(cleaner: Cleaner) {
    void handleEditCleanerSubmit((values) => {
      if (editingCleanerNameAlreadyExists) {
        setEditCleanerFormError('name', {
          type: 'manual',
          message: 'That cleaner already exists.',
        })
        return
      }

      if (!isThemeCleanerColor(selectedEditingCleanerColor)) {
        setEditCleanerFormError('colorHex', {
          type: 'manual',
          message: 'Choose one of the suggested theme colors',
        })
        return
      }

      const previousCleaners = localCleaners.map((item) => ({ ...item }))
      const nextName = values.name
      const nextColorHex = selectedEditingCleanerColor

      void runOptimisticCleanerAction(
        `update-cleaner-${cleaner.id}`,
        () => {
          setLocalCleaners((current) =>
            current.map((item) =>
              item.id === cleaner.id
                ? {
                    ...item,
                    name: nextName,
                    colorHex: nextColorHex,
                  }
                : item,
            ),
          )
          setEditingCleanerId(null)
          resetEditCleanerForm({
            name: '',
            colorHex: THEME_CLEANER_COLORS[0]?.hex ?? '#7ea8f8',
          })
        },
        () => {
          setLocalCleaners(previousCleaners)
          setEditingCleanerId(cleaner.id)
          resetEditCleanerForm({
            name: nextName,
            colorHex: nextColorHex,
          })
        },
        async () => {
          await postJson(`/api/setup/cleaners/${cleaner.id}/update`, {
            name: nextName,
            colorHex: nextColorHex,
          })
        },
      )
    })()
  }

  function handleDeleteCleaner(cleaner: Cleaner) {
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
          resetEditCleanerForm({
            name: '',
            colorHex: THEME_CLEANER_COLORS[0]?.hex ?? '#7ea8f8',
          })
        }
      },
      () => {
        setLocalCleaners(previousCleaners)
      },
      async () => {
        await postJson(`/api/setup/cleaners/${cleaner.id}/delete`)
      },
    )
  }

  const homeNameInputProps = registerHome('name')
  const homeAddressInputProps = registerHome('address')
  const homeBookingIcalUrlInputProps = registerHome('bookingIcalUrl')
  const homeAirbnbIcalUrlInputProps = registerHome('airbnbIcalUrl')
  const cleanerNameInputProps = registerCleaner('name', {
    onChange: () => {
      if (cleanerErrors.name) {
        clearCleanerErrors('name')
      }
    },
  })

  const handleAddApartmentSubmit = handleHomeSubmit((values) => {
    void runAction('add-apartment', async () => {
      await postJson('/api/setup/apartments', {
        ...values,
        latitude: addressCoordinates?.latitude,
        longitude: addressCoordinates?.longitude,
      })
      resetHomeForm()
      setAddressCoordinates(null)
      setIsAddressSuggestionsOpen(false)
      closeHomeForm()
    })
  })

  const handleAddCleanerSubmit = handleCleanerSubmit((values) => {
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
      closeCleanerForm()
    })
  })

  function handleAddressChange(nextAddress: string) {
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
  }

  function handleAddressSuggestionSelect(suggestion: PlaceSuggestion) {
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
  }

  function handleCleanerColorSelect(colorHex: string) {
    setCleanerValue('colorHex', colorHex, {
      shouldDirty: true,
      shouldValidate: true,
    })
    clearCleanerErrors('colorHex')
  }

  function handleEditCleanerColorSelect(colorHex: string) {
    setEditCleanerValue('colorHex', colorHex, {
      shouldDirty: true,
      shouldValidate: true,
    })
    clearEditCleanerErrors('colorHex')
  }

  return (
    <section className="content-stack">
      <article className="ledger-panel rounded-[1.75rem] p-5 panel-soft">
        <div className="section-head">
          <div>
            <p className="eyebrow">Workspace setup</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">Homes and cleaners</h2>
          </div>
          <p className="section-copy">
            Update homes and cleaner details here.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          <div className="setup-summary-grid">
            <ApartmentListPanel
              apartments={apartments}
              active={activeHomeForm}
              busyKey={busyKey}
              onToggle={() => setActiveTool(activeHomeForm ? null : 'home')}
              onDeleteApartment={handleDeleteApartment}
            />

            <CleanerListPanel
              cleaners={localCleaners}
              active={activeCleanerForm}
              busyKey={busyKey}
              editingCleanerId={editingCleanerId}
              editingCleanerNameError={editingCleanerNameError}
              editingCleanerColorError={editingCleanerColorError}
              selectedEditingCleanerColor={selectedEditingCleanerColor}
              editingCleanerNameTrimmed={editingCleanerNameTrimmed}
              editingCleanerNameAlreadyExists={editingCleanerNameAlreadyExists}
              editNameInputProps={editCleanerNameInputProps}
              onToggle={() => setActiveTool(activeCleanerForm ? null : 'cleaner')}
              onStartEdit={handleStartCleanerEdit}
              onCancelEdit={handleCancelCleanerEdit}
              onEditColorSelect={handleEditCleanerColorSelect}
              onSaveEdit={handleSaveCleanerEdit}
              onDeleteCleaner={handleDeleteCleaner}
            />
          </div>

          <AddApartmentForm
            open={activeHomeForm}
            busy={busyKey === 'add-apartment'}
            onClose={closeHomeForm}
            nameError={homeErrors.name?.message}
            addressError={homeErrors.address?.message}
            bookingIcalUrlError={homeErrors.bookingIcalUrl?.message}
            airbnbIcalUrlError={homeErrors.airbnbIcalUrl?.message}
            addressSuggestions={addressSuggestions}
            shouldShowAddressSuggestions={shouldShowAddressSuggestions}
            isAddressSuggestionsLoading={isAddressSuggestionsLoading}
            nameInputProps={homeNameInputProps}
            addressInputProps={homeAddressInputProps}
            bookingIcalUrlInputProps={homeBookingIcalUrlInputProps}
            airbnbIcalUrlInputProps={homeAirbnbIcalUrlInputProps}
            onAddressChange={handleAddressChange}
            onSelectSuggestion={handleAddressSuggestionSelect}
            onSubmit={handleAddApartmentSubmit}
          />

          <AddCleanerForm
            open={activeCleanerForm}
            busy={busyKey === 'add-cleaner'}
            canSubmit={canSubmitCleaner}
            onClose={closeCleanerForm}
            selectedCleanerColor={selectedCleanerColor}
            nameError={addCleanerNameError}
            colorError={cleanerErrors.colorHex?.message}
            nameInputProps={cleanerNameInputProps}
            onColorSelect={handleCleanerColorSelect}
            onSubmit={handleAddCleanerSubmit}
          />

        </div>
      </article>

      {error ? (
        <section className="error-banner">{error}</section>
      ) : null}
    </section>
  )
}
