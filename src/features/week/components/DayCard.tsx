import { Plus } from 'lucide-react'
import { formatDayLabel } from '#/lib/date'
import type { ScheduleDayGroup } from '#/lib/types'

function getSourceLabel(row: ScheduleDayGroup['rows'][number]) {
  if (row.sourceManualRequestId) {
    return 'Manual'
  }

  if (row.bookingSource === 'booking') {
    return 'Booking.com'
  }

  if (row.bookingSource === 'airbnb') {
    return 'Airbnb'
  }

  return null
}

export function DayCard({
  group,
  open,
  isToday = false,
  badges = [],
  tone = 'default',
  onToggle,
  onRowSelect,
  onAddJob,
}: {
  group: ScheduleDayGroup
  open: boolean
  isToday?: boolean
  badges?: string[]
  tone?: 'default' | 'attention' | 'changed'
  onToggle: () => void
  onRowSelect?: (row: ScheduleDayGroup['rows'][number]) => void
  onAddJob?: (date: string) => void
}) {
  const alwaysOpen = group.rows.length === 1
  const isOpen = alwaysOpen || open

  const summaryContent = (
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
        {group.rows.length === 0 ? 'No cleans booked' : `${group.rows.length} ${group.rows.length === 1 ? 'clean' : 'cleans'}`}
      </p>
    </div>
  )

  return (
    <article className={`day-card ${isToday ? 'is-today' : ''} ${tone !== 'default' ? `is-${tone}` : ''}`}>
      <div className="day-header">
        {alwaysOpen ? (
          <div className="day-summary day-summary-static">{summaryContent}</div>
        ) : (
          <button type="button" className="day-summary day-summary-trigger" onClick={onToggle}>
            {summaryContent}
          </button>
        )}

        <div className="day-summary-actions">
          {onAddJob ? (
            <button
              type="button"
              className="day-mini-action"
              onClick={() => onAddJob(group.date)}
              aria-label={`Add a clean to ${formatDayLabel(group.date)}`}
            >
              <Plus size={14} />
              <span>Add clean</span>
            </button>
          ) : null}
          {alwaysOpen ? null : (
            <button type="button" className="day-toggle-chip" onClick={onToggle}>
              {open ? 'Collapse' : 'Expand'}
            </button>
          )}
        </div>
      </div>

      {isOpen ? (
        <div className="day-body">
          {group.rows.length === 0 ? (
            <p className="text-sm leading-7 text-[var(--ink-soft)]">No clean is scheduled for this day.</p>
          ) : (
            group.rows.map((row) => {
              const sourceLabel = getSourceLabel(row)

              return (
                <button key={row.id} type="button" className="detail-card detail-action" onClick={() => onRowSelect?.(row)}>
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink-strong)]">{row.apartmentName}</p>
                    {sourceLabel ? (
                      <p className="mt-1 text-xs uppercase tracking-[0.08em] text-[var(--ink-soft)]">{sourceLabel}</p>
                    ) : null}
                    <p className="mt-1 text-sm text-[var(--ink-soft)]">{row.notes ?? 'Planned clean'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="cleaner-chip"
                      style={
                        row.cleanerColorHex
                          ? {
                              borderColor: `${row.cleanerColorHex}66`,
                              backgroundColor: `${row.cleanerColorHex}1f`,
                            }
                          : undefined
                      }
                    >
                      {row.cleanerColorHex ? (
                        <span className="cleaner-dot" style={{ backgroundColor: row.cleanerColorHex }} aria-hidden="true" />
                      ) : null}
                      {row.cleanerName ?? 'Not assigned'}
                    </span>
                    {onRowSelect ? <span className="cleaner-chip subtle-chip">Edit</span> : null}
                  </div>
                </button>
              )
            })
          )}
        </div>
      ) : null}
    </article>
  )
}
