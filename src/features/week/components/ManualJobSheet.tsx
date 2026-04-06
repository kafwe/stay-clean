import type { Apartment } from '#/lib/types'
import { SheetDialog } from './SheetDialog'

export function ManualJobSheet({
  open,
  dayLabel,
  apartments,
  apartmentId,
  busy,
  successMessage,
  onApartmentChange,
  onClose,
  onSubmit,
}: {
  open: boolean
  dayLabel: string
  apartments: Apartment[]
  apartmentId: string
  busy: boolean
  successMessage?: string | null
  onApartmentChange: (value: string) => void
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    <SheetDialog open={open} onClose={onClose} ariaLabel="Add clean" panelClassName="sheet-panel-feature">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Add clean</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">{dayLabel}</h2>
        </div>
        <button type="button" className="action-ghost sheet-close-button" onClick={onClose}>
          Close
        </button>
      </div>
      {successMessage ? (
        <section className="inline-feedback inline-feedback-success" role="status" aria-live="polite">
          {successMessage}
        </section>
      ) : null}

      <form
        className="mt-5 space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <select
          className="field"
          value={apartmentId}
          onChange={(event) => onApartmentChange(event.target.value)}
          data-autofocus="true"
        >
          <option value="">Choose home</option>
          {apartments.map((apartment) => (
            <option key={apartment.id} value={apartment.id}>
              {apartment.colloquialName ?? apartment.name}
            </option>
          ))}
        </select>
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" className="action-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="action-primary" disabled={busy || !apartmentId}>
            {busy ? 'Adding...' : 'Add clean'}
          </button>
        </div>
      </form>
    </SheetDialog>
  )
}
