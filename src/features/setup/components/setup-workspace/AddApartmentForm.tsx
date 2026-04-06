import type { FormEventHandler } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import type { PlaceSuggestion } from './types'
import { SheetDialog } from '#/features/week/components/SheetDialog'

export function AddApartmentForm({
  open,
  busy,
  onClose,
  nameError,
  addressError,
  bookingIcalUrlError,
  airbnbIcalUrlError,
  addressSuggestions,
  shouldShowAddressSuggestions,
  isAddressSuggestionsLoading,
  nameInputProps,
  addressInputProps,
  bookingIcalUrlInputProps,
  airbnbIcalUrlInputProps,
  onAddressChange,
  onSelectSuggestion,
  onSubmit,
}: {
  open: boolean
  busy: boolean
  onClose: () => void
  nameError?: string
  addressError?: string
  bookingIcalUrlError?: string
  airbnbIcalUrlError?: string
  addressSuggestions: PlaceSuggestion[]
  shouldShowAddressSuggestions: boolean
  isAddressSuggestionsLoading: boolean
  nameInputProps: UseFormRegisterReturn
  addressInputProps: UseFormRegisterReturn
  bookingIcalUrlInputProps: UseFormRegisterReturn
  airbnbIcalUrlInputProps: UseFormRegisterReturn
  onAddressChange: (nextAddress: string) => void
  onSelectSuggestion: (suggestion: PlaceSuggestion) => void
  onSubmit: FormEventHandler<HTMLFormElement>
}) {
  return (
    <SheetDialog open={open} onClose={onClose} ariaLabel="Add home" panelClassName="sheet-panel-feature">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Workspace setup</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">Add a home</h2>
        </div>
        <button type="button" className="action-ghost sheet-close-button" onClick={onClose}>
          Close
        </button>
      </div>

      <form className="mt-5 space-y-3" noValidate onSubmit={onSubmit}>
        {nameError ? <p className="text-xs text-[var(--accent-deep)]">{nameError}</p> : null}
        <input
          className="field"
          placeholder="Listing name"
          {...nameInputProps}
          data-autofocus="true"
          aria-invalid={nameError ? 'true' : undefined}
        />

        <div className="address-field-wrap">
          {addressError ? <p className="mb-2 text-xs text-[var(--accent-deep)]">{addressError}</p> : null}
          <input
            className="field"
            placeholder="Street address"
            {...addressInputProps}
            onChange={(event) => {
              addressInputProps.onChange(event)
              onAddressChange(event.target.value)
            }}
            autoComplete="off"
            aria-invalid={addressError ? 'true' : undefined}
          />
          {shouldShowAddressSuggestions ? (
            <div className="address-suggestions" role="listbox" aria-label="Address suggestions">
              {addressSuggestions.map((suggestion) => (
                <button
                  key={`${suggestion.label}-${suggestion.latitude}-${suggestion.longitude}`}
                  type="button"
                  className="address-suggestion-item"
                  onClick={() => onSelectSuggestion(suggestion)}
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {isAddressSuggestionsLoading ? <p className="text-xs text-[var(--ink-soft)]">Looking up addresses...</p> : null}
        {bookingIcalUrlError ? <p className="text-xs text-[var(--accent-deep)]">{bookingIcalUrlError}</p> : null}
        <input
          className="field"
          placeholder="Booking.com iCal URL (optional)"
          {...bookingIcalUrlInputProps}
          aria-invalid={bookingIcalUrlError ? 'true' : undefined}
        />
        {airbnbIcalUrlError ? <p className="text-xs text-[var(--accent-deep)]">{airbnbIcalUrlError}</p> : null}
        <input
          className="field"
          placeholder="Airbnb iCal URL (optional)"
          {...airbnbIcalUrlInputProps}
          aria-invalid={airbnbIcalUrlError ? 'true' : undefined}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" className="action-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="action-primary" disabled={busy}>
            {busy ? 'Saving...' : 'Add home'}
          </button>
        </div>
      </form>
    </SheetDialog>
  )
}
