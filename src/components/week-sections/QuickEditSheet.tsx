import { ExternalLink } from 'lucide-react'
import { formatDayLabel } from '#/lib/date'
import { SheetDialog } from './SheetDialog'

export function QuickEditSheet({
  open,
  title,
  deleteLabel,
  deleteHint,
  cleanerId,
  notes,
  taskDate,
  bookingUrl,
  cleaners,
  dateOptions,
  saving,
  deleting,
  onClose,
  onCleanerChange,
  onNotesChange,
  onTaskDateChange,
  onSave,
  onDelete,
}: {
  open: boolean
  title: string
  deleteLabel: string
  deleteHint?: string
  cleanerId: string
  notes: string
  taskDate: string
  bookingUrl?: string | null
  cleaners: Array<{ id: string; name: string }>
  dateOptions: string[]
  saving: boolean
  deleting: boolean
  onClose: () => void
  onCleanerChange: (value: string) => void
  onNotesChange: (value: string) => void
  onTaskDateChange: (value: string) => void
  onSave: () => void
  onDelete: () => void
}) {
  return (
    <SheetDialog open={open} onClose={onClose} ariaLabel="Edit clean">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Edit clean</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">{title}</h2>
          {bookingUrl ? (
            <a href={bookingUrl} target="_blank" rel="noreferrer" className="booking-context-link mt-2">
              <span className="booking-context-action">View reservation</span>
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          ) : null}
        </div>
        <button type="button" className="action-ghost sheet-close-button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[var(--ink-strong)]">Cleaner</span>
          <select
            className="field"
            value={cleanerId}
            onChange={(event) => onCleanerChange(event.target.value)}
            data-autofocus="true"
          >
            <option value="">Not assigned</option>
            {cleaners.map((cleaner) => (
              <option key={cleaner.id} value={cleaner.id}>
                {cleaner.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[var(--ink-strong)]">Day</span>
          <select className="field" value={taskDate} onChange={(event) => onTaskDateChange(event.target.value)}>
            {dateOptions.map((date) => (
              <option key={date} value={date}>
                {formatDayLabel(date)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[var(--ink-strong)]">Notes</span>
          <textarea
            rows={4}
            className="field"
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder="Add notes for this clean."
          />
        </label>
      </div>

      <div className="sheet-danger-zone">
        <div>
          <p className="text-sm font-semibold text-[var(--ink-strong)]">{deleteLabel}</p>
          <p className="mt-1 text-sm leading-7 text-[var(--ink-soft)]">
            {deleteHint ?? 'This clean will be removed from this week.'}
          </p>
        </div>
        <button type="button" className="action-danger" disabled={deleting} onClick={onDelete}>
          {deleting ? 'Removing...' : deleteLabel}
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button type="button" className="action-secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="action-primary" disabled={saving} onClick={onSave}>
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </SheetDialog>
  )
}
