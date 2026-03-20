import { ChevronLeft, ChevronRight, MessageSquareText } from 'lucide-react'
import { formatDayLabel } from '#/lib/date'
import type { ChangeSet, ManualReviewItem, ScheduleDayGroup, ScheduleStatus } from '#/lib/types'

export function getWeekStatusLabel(status: string | null) {
  if (status === 'confirmed') {
    return 'Locked in'
  }

  if (status === 'needs_review') {
    return 'Changes waiting'
  }

  if (status === 'draft') {
    return 'Ready to check'
  }

  return 'Getting started'
}

export function WeekPanelHeader({
  eyebrow = 'Week in view',
  title,
  status,
  summaryItems,
  showStatus = true,
  showWeekControls = true,
  showThisWeekButton,
  onPrevious,
  onCurrent,
  onNext,
  children,
}: {
  eyebrow?: string
  title: string
  status: ScheduleStatus | null
  summaryItems: string[]
  showStatus?: boolean
  showWeekControls?: boolean
  showThisWeekButton: boolean
  onPrevious: () => void
  onCurrent: () => void
  onNext: () => void
  children?: React.ReactNode
}) {
  return (
    <section className="compact-hero sticky-mobile-header">
      <div className="compact-hero-top">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display-title mt-1.5 text-[2rem] leading-[0.96] text-[var(--ink-strong)]">
            {title}
          </h1>
        </div>
        {showStatus ? <span className="status-pill">{getWeekStatusLabel(status)}</span> : null}
      </div>

      <div className="summary-strip">
        {summaryItems.map((item) => (
          <span key={item} className="summary-chip">
            {item}
          </span>
        ))}
      </div>

      {showWeekControls ? (
        <div className="compact-switcher">
          <button
            type="button"
            className="icon-button"
            onClick={onPrevious}
            aria-label="Earlier week"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="action-ghost flex-1"
            onClick={onCurrent}
            disabled={!showThisWeekButton}
          >
            This week
          </button>
          <button type="button" className="icon-button" onClick={onNext} aria-label="Later week">
            <ChevronRight size={18} />
          </button>
        </div>
      ) : null}

      {children ? <div className="mt-3 space-y-3">{children}</div> : null}
    </section>
  )
}

export function DayCard({
  group,
  open,
  isToday = false,
  badges = [],
  tone = 'default',
  onToggle,
  onRowSelect,
}: {
  group: ScheduleDayGroup
  open: boolean
  isToday?: boolean
  badges?: string[]
  tone?: 'default' | 'attention' | 'changed'
  onToggle: () => void
  onRowSelect?: (row: ScheduleDayGroup['rows'][number]) => void
}) {
  return (
    <article className={`day-card ${isToday ? 'is-today' : ''} ${tone !== 'default' ? `is-${tone}` : ''}`}>
      <button type="button" className="day-summary" onClick={onToggle}>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="day-title">{formatDayLabel(group.date)}</p>
            {isToday ? <span className="cleaner-chip today-chip">Today</span> : null}
            {badges.map((badge) => (
              <span key={badge} className="cleaner-chip subtle-chip">
                {badge}
              </span>
            ))}
          </div>
          <p className="day-subtitle">
            {group.rows.length === 0
              ? 'Nothing booked'
              : `${group.rows.length} ${group.rows.length === 1 ? 'job' : 'jobs'}`}
          </p>
        </div>
        <span className="cleaner-chip">{open ? 'Hide' : 'Open'}</span>
      </button>

      {open ? (
        <div className="day-body">
          {group.rows.length === 0 ? (
            <p className="text-sm leading-7 text-[var(--ink-soft)]">
              No cleaning is scheduled for this day.
            </p>
          ) : (
            group.rows.map((row) => (
              <button
                key={row.id}
                type="button"
                className="detail-card detail-action"
                onClick={() => onRowSelect?.(row)}
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--ink-strong)]">
                    {row.apartmentName}
                  </p>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">
                    {row.notes ?? 'Scheduled clean'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="cleaner-chip">{row.cleanerName ?? 'Unassigned'}</span>
                  {onRowSelect ? <span className="cleaner-chip subtle-chip">Edit</span> : null}
                </div>
              </button>
            ))
          )}
        </div>
      ) : null}
    </article>
  )
}

export function ReviewPanel({
  title,
  emptyCopy,
  changeSets,
  busyKey,
  onApprove,
  onReject,
}: {
  title: string
  emptyCopy: string
  changeSets: ChangeSet[]
  busyKey: string | null
  onApprove: (changeSetId: string) => Promise<void>
  onReject: (changeSetId: string) => Promise<void>
}) {
  return (
    <article className="ledger-panel rounded-[1.75rem] p-5">
      <p className="eyebrow">Waiting for you</p>
      <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">{title}</h2>

      <div className="mt-5 space-y-4">
        {changeSets.length ? (
          changeSets.map((changeSet) => (
            <div key={changeSet.id} className="change-card">
              <h3 className="text-base font-semibold text-[var(--ink-strong)]">{changeSet.title}</h3>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">{changeSet.summary}</p>

              <div className="mt-4 space-y-2">
                {changeSet.payload.changes.map((change) => (
                  <div key={`${change.date}-${change.apartmentName}`} className="change-row">
                    <span>
                      {change.date} • {change.apartmentName}
                    </span>
                    <span>
                      {change.beforeCleaner ?? '-'} → {change.afterCleaner ?? '-'}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="action-primary"
                  disabled={busyKey === `approve-${changeSet.id}`}
                  onClick={() => {
                    void onApprove(changeSet.id)
                  }}
                >
                  {busyKey === `approve-${changeSet.id}` ? 'Saving...' : 'Use this change'}
                </button>
                <button
                  type="button"
                  className="action-secondary"
                  disabled={busyKey === `reject-${changeSet.id}`}
                  onClick={() => {
                    void onReject(changeSet.id)
                  }}
                >
                  {busyKey === `reject-${changeSet.id}` ? 'Saving...' : 'Keep current plan'}
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm leading-7 text-[var(--ink-soft)]">{emptyCopy}</p>
        )}
      </div>
    </article>
  )
}

export function ManualReviewPanel({
  items,
}: {
  items: ManualReviewItem[]
}) {
  return (
    <article className="ledger-panel rounded-[1.75rem] p-5">
      <p className="eyebrow">Check these stays</p>
      <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">Long stays to review</h2>
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="detail-card items-start">
              <div>
                <p className="text-sm font-semibold text-[var(--ink-strong)]">{item.apartmentName}</p>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">
                  {item.checkIn} to {item.checkOut} • {item.nights} nights
                </p>
              </div>
              <span className="cleaner-chip warning">{item.note}</span>
            </div>
          ))
        ) : (
          <p className="text-sm leading-7 text-[var(--ink-soft)]">
            No longer bookings need a check for this week.
          </p>
        )}
      </div>
    </article>
  )
}

export function MessageComposer({
  message,
  busy,
  onChange,
  onSubmit,
}: {
  message: string
  busy: boolean
  onChange: (value: string) => void
  onSubmit: () => void
}) {
  return (
    <article className="ledger-panel rounded-[1.75rem] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Send a message</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">
            Change the plan in plain language
          </h2>
        </div>
        <MessageSquareText className="text-[var(--accent)]" size={20} />
      </div>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
        Nothing changes until you review and approve the suggestion.
      </p>
      <form
        className="mt-5 space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <textarea
          value={message}
          onChange={(event) => onChange(event.target.value)}
          rows={5}
          className="field min-h-32"
          placeholder="Example: Give Sis Nolu Monday off and move her jobs to Lovey."
        />
        <button type="submit" className="action-primary w-full" disabled={busy || !message.trim()}>
          {busy ? 'Preparing...' : 'Prepare change'}
        </button>
      </form>
    </article>
  )
}

export function QuickEditSheet({
  open,
  title,
  cleanerId,
  notes,
  taskDate,
  cleaners,
  dateOptions,
  saving,
  onClose,
  onCleanerChange,
  onNotesChange,
  onTaskDateChange,
  onSave,
}: {
  open: boolean
  title: string
  cleanerId: string
  notes: string
  taskDate: string
  cleaners: Array<{ id: string; name: string }>
  dateOptions: string[]
  saving: boolean
  onClose: () => void
  onCleanerChange: (value: string) => void
  onNotesChange: (value: string) => void
  onTaskDateChange: (value: string) => void
  onSave: () => void
}) {
  if (!open) {
    return null
  }

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true">
      <div className="sheet-panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Quick edit</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">{title}</h2>
          </div>
          <button type="button" className="action-ghost !w-auto" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[var(--ink-strong)]">Cleaner</span>
            <select className="field" value={cleanerId} onChange={(event) => onCleanerChange(event.target.value)}>
              <option value="">Unassigned</option>
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
              placeholder="Add a helpful note for this clean."
            />
          </label>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button type="button" className="action-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="action-primary" disabled={saving} onClick={onSave}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
