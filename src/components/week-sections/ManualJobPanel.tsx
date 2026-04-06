import { formatDayLabel } from '#/lib/date'
import type { Apartment } from '#/lib/types'

export function ManualJobPanel({
  apartments,
  dateOptions,
  taskDate,
  apartmentId,
  busy,
  successMessage,
  onTaskDateChange,
  onApartmentChange,
  onSubmit,
}: {
  apartments: Apartment[]
  dateOptions: string[]
  taskDate: string
  apartmentId: string
  busy: boolean
  successMessage?: string | null
  onTaskDateChange: (value: string) => void
  onApartmentChange: (value: string) => void
  onSubmit: () => void
}) {
  return (
    <article className="ledger-panel rounded-[1.75rem] p-5 panel-feature panel-review">
      <p className="eyebrow">Add manually</p>
      <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">Add an extra clean</h2>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">Use this for one-off cleans.</p>
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
        <select className="field" value={taskDate} onChange={(event) => onTaskDateChange(event.target.value)}>
          <option value="">Choose day</option>
          {dateOptions.map((date) => (
            <option key={date} value={date}>
              {formatDayLabel(date)}
            </option>
          ))}
        </select>
        <select className="field" value={apartmentId} onChange={(event) => onApartmentChange(event.target.value)}>
          <option value="">Choose home</option>
          {apartments.map((apartment) => (
            <option key={apartment.id} value={apartment.id}>
              {apartment.colloquialName ?? apartment.name}
            </option>
          ))}
        </select>
        <button type="submit" className="action-secondary w-full" disabled={busy || !taskDate || !apartmentId}>
          {busy ? 'Adding...' : 'Add clean'}
        </button>
      </form>
    </article>
  )
}
