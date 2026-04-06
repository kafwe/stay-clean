import type { FormEventHandler } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import type { PlaceSuggestion } from './types'

export function AddApartmentForm({
  visible,
  busy,
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
  visible: boolean
  busy: boolean
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
  if (!visible) {
    return null
  }

  return (
    <form className="fold-panel space-y-3" noValidate onSubmit={onSubmit}>
      <div className="space-y-1">
        <h2 className="section-title">Add a home</h2>
      </div>
      {nameError ? <p className="text-xs text-[var(--accent-deep)]">{nameError}</p> : null}
      <input
        className="field"
        placeholder="Listing name"
        {...nameInputProps}
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
      <button type="submit" className="action-secondary" disabled={busy}>
        {busy ? 'Saving...' : 'Add home'}
      </button>
    </form>
  )
}
